'use strict';

// Load promises polyfill if necessary
let Promise = global.Promise;
/* istanbul ignore if */
if (typeof Promise === 'undefined') {
  Promise = require('es6-promise').Promise;
}

const path = require('path');
const fs = require('fs');
const debug = require('debug')('multi-schema-linker');

const _ = require('lodash');
const yaml = require('js-yaml');
const pointer = require('json-pointer');

function isCollision(config, rootObj, defName, defObj) {
  if (!pointer.has(rootObj, `${config.definitionsPointer}/${defName}`)) {
    return false;
  }
  const obj = pointer.get(rootObj, `${config.definitionsPointer}/${defName}`);
  return obj && obj !== defObj;
}

function addDefinition(config, rootObj, defObj, fileName) {
  const defBase = path.basename(fileName, path.extname(fileName));
  let defName = defBase;
  let i = 0;
  while (isCollision(config, rootObj, defName, defObj)) {
    defName = `${defBase}-${++i}`;
  }
  const pathToDef = `${config.definitionsPointer}/${defName}`;

  const linkToDef = `#${pathToDef}`;

  pointer.set(rootObj, pathToDef, defObj);

  return linkToDef;
}

function getFilePath(config, sourcePath, targetPath) {
  try {
    const isAbsolute = path.isAbsolute(targetPath);

    if (isAbsolute) {
      return path.resolve(path.join(config.rootPath, targetPath));
    }

    const sourceDir = path.dirname(sourcePath);
    const targetAbsPath = path.join(sourceDir, targetPath);

    return path.resolve(targetAbsPath);
  } catch (err) {
    debug(`error in getFilePath ${err}`);
    throw new Error(`reference path is invalid: ${targetPath}`);
  }
}

function getJsonContent(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        debug(`error reading json file ${filePath}, ${readErr}`);
        return reject(readErr);
      }
      try {
        const doc = JSON.parse(content);
        debug(`json file parsed ${filePath}`);
        return resolve(doc);
      } catch (catchErr) {
        debug(`error parsing json file ${filePath}, ${catchErr}`);
        return reject(catchErr);
      }
    });
  });
}

function getYamlContent(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        debug(`error reading yaml file ${filePath}, ${readErr}`);
        return reject(readErr);
      }
      try {
        const doc = yaml.safeLoad(content);
        debug(`yaml file parsed ${filePath}`);
        return resolve(doc);
      } catch (catchErr) {
        debug(`error parsing yaml file ${filePath}, ${catchErr}`);
        return reject(catchErr);
      }
    });
  });
}

function getContent(filePath) {
  const extName = path.extname(filePath);
  switch (extName) {
    case '.yaml':
    case '.yml':
      return getYamlContent(filePath);
    case '.json':
      return getJsonContent(filePath);
    default:
      throw new Error(`invalid file type: ${filePath}`);
  }
}

function writeJsonContent(filePath, content) {
  return new Promise((resolve, reject) => {
    try {
      const text = JSON.stringify(content);
      debug(`json file stringified ${filePath}`);

      return fs.writeFile(filePath, text, (writeErr) => {
        if (writeErr) {
          debug(`error reading json file ${filePath}, ${writeErr}`);
          return reject(writeErr);
        }

        return resolve();
      });
    } catch (catchErr) {
      debug(`error stringifying json file ${filePath}, ${catchErr}`);
      return reject(catchErr);
    }
  });
}

function writeYamlContent(filePath, content) {
  return new Promise((resolve, reject) => {
    try {
      const text = yaml.safeDump(content);
      debug(`yaml file stringified ${filePath}`);

      return fs.writeFile(filePath, text, (writeErr) => {
        if (writeErr) {
          debug(`error reading yaml file ${filePath}, ${writeErr}`);
          return reject(writeErr);
        }

        return resolve();
      });
    } catch (catchErr) {
      debug(`error stringifying yaml file ${filePath}, ${catchErr}`);
      return reject(catchErr);
    }
  });
}

function writeContent(filePath, content) {
  const extName = path.extname(filePath);
  switch (extName) {
    case '.yaml':
    case '.yml':
      return writeYamlContent(filePath, content);
    case '.json':
      return writeJsonContent(filePath, content);
    default:
      throw new Error(`invalid file type: ${filePath}`);
  }
}

function generateComponentSub(config, componentPath, obj, rootObj) {
  const dict = pointer.dict(obj);

  let promiseChain = Promise.resolve();

  _.each(dict, (value, partPath) => {
    promiseChain = promiseChain.then(() => {
      const parsed = pointer.parse(partPath);
      const token = _.last(parsed);

      const isReplace = token === config.replaceToken;
      const isDefine = token === config.defineReferenceToken;

      if (!isReplace && !isDefine) {
        return Promise.resolve();
      }

      const targetFilePath = getFilePath(config, componentPath, value);

      return checkFileReadable(targetFilePath)
        .then(() => generateComponent(config, targetFilePath))
        .then((content) => {
          if (isDefine) {
            const filename = path.basename(targetFilePath);
            const refPath = addDefinition(config, rootObj || obj, content, filename);

            const parsedClone = parsed.slice();

            parsedClone.splice(-1, 1, config.referenceToken);

            const newPartPath = pointer.compile(parsedClone);

            pointer.remove(obj, partPath);
            pointer.set(obj, newPartPath, refPath);
            return;
          }

          const parsedClone = parsed.slice();

          parsedClone.splice(-1, 1);

          const newPartPath = pointer.compile(parsedClone);
          pointer.set(obj, newPartPath, content);
          return;
        });
    });
  });

  return promiseChain
    .then(() => obj);
}

function checkFileReadable(filePath) {
  return new Promise((resolve, reject) => {
    fs.access(filePath, fs.R_OK, (err) => {
      if (err) {
        debug(`file readable error, ${err.stack}`);
        return reject(new Error(`File is not readable: ${filePath}`));
      }

      return resolve();
    });
  });
}

function checkFileWritable(filePath) {
  return new Promise((resolve, reject) => {
    fs.access(filePath, fs.W_OK, (err) => {
      if (err && err.code !== 'ENOENT') {
        debug(`file writable error, ${err.stack}`);
        return reject(new Error(`File is not writable: ${filePath}`));
      }
      return resolve();
    });
  });
}

function generateComponent(config, componentPath) {
  if (!config.cache) {
    config.cache = {};
  }
  if (!config.cache[componentPath]) {
    config.cache[componentPath] = getContent(componentPath)
      .then((content) => {
        if (!config.rootObj) {
          config.rootObj = content;
        }
        return generateComponentSub(config, componentPath, content, config.rootObj);
      });
  }
  return config.cache[componentPath];
}
module.exports.generateComponent = generateComponent;

function generateToFile(inputPath, outputPath, _config) {
  return checkFileReadable(inputPath)
    .then(() => checkFileWritable(outputPath))
    .then(() => {
      const config = _.assign({
        definitionsPointer: '/definitions',
        replaceToken: '$x-r-ref',
        defineReferenceToken: '$x-d-ref',
        referenceToken: '$ref',

        rootPath: path.dirname(inputPath),
        cache: {},
      }, _config || {});

      return generateComponent(config, inputPath);
    })
    .then((result) => {
      return writeContent(outputPath, result);
    });
}
module.exports.generateToFile = generateToFile;
