/**
 * NOTE: This code is transpiled from ES2017 using Babel.
 * Instead of modifying this file directly, work with the source code instead and upload the transpiled output here.
 */'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const DeploymentTools = require('serverless_githook_to_s3');

exports.handler = (() => {
  var _ref = _asyncToGenerator(function* (event, context, callback) {
    const bucketName = process.env.BUCKET;
    const gitHookKey = process.env.GITHUB_WEBHOOK_SECRET;
    const gitAPIkey = process.env.GITHUB_API_TOKEN;

    const allowedPrefixes = ['beta-'];

    const releaseRef = event.body.ref.split('/');
    if (releaseRef[1] === 'tags' && checkPrefix(releaseRef[2])) {

      const deploymentTools = new DeploymentTools(null, event, callback, bucketName, gitHookKey, gitAPIkey, 'dist');

      // Process incoming gitHook event.
      if (deploymentTools.processIncommingGitHook()) {
        const branchName = yield deploymentTools.listGitRepoBranches('get deployed');
        yield deploymentTools.getFilesFromGit(branchName);
        yield deploymentTools.putFilesOnS3();

        deploymentTools.closeTask();
      }
    } else {
      console.log('This is not a valid tag for processing: ' + releaseRef[2]);
      const response = {
        statusCode: 200,
        body: JSON.stringify({
          input: event
        })
      };

      return callback(null, response);
    }

    function checkPrefix(tag) {
      let result = false;
      allowedPrefixes.forEach(allowed => {
        console.log(allowed);
        console.log(tag);
        if (!result) result = tag.startsWith(allowed);
      });

      return result;
    }
  });

  return function (_x, _x2, _x3) {
    return _ref.apply(this, arguments);
  };
})();
