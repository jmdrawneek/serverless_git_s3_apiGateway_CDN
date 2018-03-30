const request = require('request');
const AWS = require('aws-sdk');
const fs = require('fs');
const utilities = require('./utilities');

const path = 'dist';
// Get the target S3 bucket that's passed from the serverless configuration as an environment variable.
const bucketName = process.env.BUCKET;

const zlib = require('zlib');

const s3 = new AWS.S3({
  params: {
    Bucket: bucketName
  }
});

const putFileToS3 = (fileObject, folder) => new Promise((resolve, reject) => {
  const gzip = zlib.createGzip();

  console.log(fileObject.download_url);

  request(fileObject.download_url)
    .pipe(gzip)
    .pipe(fs.createWriteStream(`/tmp/${fileObject.name}`))
    .on('error', function(err) {
    console.log(err)
    })
    .on('finish', () => {
      console.log('File key: ', folder + fileObject.name);
      s3.upload({
        Bucket: bucketName,
        Key: folder + fileObject.name,
        Body: fs.createReadStream(`/tmp/${fileObject.name}`),
        ACL: 'public-read',
        CacheControl: 'max-age=31536000',
        ContentType: utilities.computeContentType(fileObject.name)
      }, (error) => {
        if (error) {
          console.log(error);
          throw new Error('Error connecting to s3 bucket. ' + error);
        }
        else return resolve();
      });
    });
});

exports.handler = (event, context, callback) => {
  let newRelease = true;
  // Split ref into an array.
  const releaseRef = JSON.parse(event.Records[0].Sns.Message).ref.split('/');

  // Check if tag matches release format.
  if (releaseRef[1] === 'tags' && releaseRef[2].startsWith('rc-')) {
    const folder = releaseRef[2].substring(3).replace(/\./g, '-') + '/';
    const downloadsUrl = JSON.parse(event.Records[0].Sns.Message).repository.contents_url.replace('{+path}', path);

    request({
      uri: downloadsUrl,
      headers: {
        'User-Agent': 'AWS Lambda Function' // Without that Github will reject all requests
      }
    }, (error, response, body) => {
      if (error) {
        callback(error, `Fetching the resources from: ${downloadsUrl} failed.`);
      }

      const githubResponse = JSON.parse(body);


      // Check if the folder has already been created.
      newRelease = new Promise((resolve, reject) => {

        s3.headObject({Bucket: bucketName, Key: folder + githubResponse[0].name}, function(err, data) {
          if (err && err.code === 'NotFound') {
            console.log('This is a release');
            return resolve(false);
          }
          else {
            console.log(folder + githubResponse[0].name);
            console.log('This is a redeployment');
            return resolve(true);
          }
        });
      });

      newRelease.then(function (checkForFiles) {

        githubResponse.forEach((fileObject, index) => {

          putFileToS3(fileObject, folder)
            .catch((error) => callback(error, `Error while uploading ${fileObject.name} file to S3`))
            .then(() => {
              if ((githubResponse.length - 1) === index) {
                return !checkForFiles ? notifyUsersOfRelease(releaseRef) : callback(null, 'Detected old release, updating files without sending notifications');
              }
            });
        })
      })
    });
  }

  function notifyUsersOfRelease (releaseRef) {

    // Ignore develop and master tag updates.
    if (releaseRef[2].indexOf('rc-') > -1) {
      console.log('SENDING RELEASE NOTIFICATION');

      const respObj =
        [
          {
            source: 'cdn',
            trigger: 'deploy',
            client: 'royalCanin',
            sendGridData: {
              sgAccount: 'first10',
              segment: process.env.SEGMENT,
              // Segment IDs need to be added in the send grid tools lambda function.
              //segment: 'Testers',
              template: process.env.EMAIL_TEMPLATE
            },
            content: {
              version_number: releaseRef[2].slice(releaseRef[2].indexOf('-') + 1)
            }
          }
        ];

      const response = {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/plain'
        },
        body: 'Deployment Complete'
      };

      request(
        {
          method: 'POST',
          json: true,
          url: process.env.API + '/sendGrid/send/',
          body: JSON.stringify(respObj)
        },
        function (err, res, body) {
          if (err) console.log(err);

          var headers = res.headers;
          var statusCode = res.statusCode;
          console.log('headers: ', headers);
          console.log('statusCode: ', statusCode);
          console.log('body: ', body);

          callback(null, response);
        });


      // Slack intergration
      const webhook = 'https://hooks.slack.com/services/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';

      const Slack = require('node-slack');
      const slack = new Slack(webhook);

      slack.send({
        text: `Version ${releaseRef[2].slice(releaseRef[2].indexOf('-') + 1).replace(/-/g, '.')} has just been released.`,
        channel: '#rcdlupdates',
        username: 'Deployment Automation'
      });

      return callback(null, 'Release complete');

    }
  }
};
