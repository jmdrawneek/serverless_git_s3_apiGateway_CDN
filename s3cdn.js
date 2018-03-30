'use strict';

const aws = require('aws-sdk');
const utilities = require('./utilities');


const s3 = new aws.S3();

exports.handler = function(event, context, callback) {
    console.log(JSON.stringify(event));
    if (typeof event.queryStringParameters.v !== 'undefined') {
      const bucket = process.env.BUCKET;
      const key = event.queryStringParameters.v + event.path;
      const params = {
        Bucket: bucket,
        Key: key
      };

      s3.getObject(params, function (err, data) {
        // Handle any error and exit
        if (err) {
          callback(err, 'Error when trying to get S3 object.')
          return err;
        }

        const response = {
          statusCode: 200,
          headers: {
            "Cache-Control": "max-age=31536000",
            "Content-Type": utilities.computeContentType(event.path),
            "Access-Control-Allow-Origin": "*", // Required for CORS support to work
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Accept-Encoding": "identity",
            "Content-Encoding" : "gzip",
            "Access-Control-Allow-Credentials": true // Required for cookies, authorization headers with HTTPS
          },
          body: new Buffer(data.Body).toString('base64'),
          isBase64Encoded: true
        };

        console.log("response: " + JSON.stringify(response))
        callback(null, response);

      });
    }
    else {
      callback(new Error('No version parameter found in request string.'), 'Error');
    }
};

