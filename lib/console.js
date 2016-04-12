'use strict';

const program = require('commander');

const debug = require('debug')('multi-schema-linker');

const packageJson = require('../package.json');
const generator = require('./generator.js');

let validArguments = false;

program
  .version(packageJson.version)
  .arguments('<inputPath> <outputPath>')
  .option('--definitionsPointer <pointer>', 'Json pointer to the definitions.', String, '/definitions')
  .option('--replaceToken <token>', 'Replace token, will be replaced with referenced content.', String, '$x-r-ref')
  .option(
    '--defineReferenceToken <token>',
    'Define reference token, will be replaced with a reference token to the referenced content.',
    String,
    '$x-d-ref'
  )
  .option('--referenceToken <token>', 'Reference token for define references.', String, '$ref')
  .option('--rootPath <path>', 'Root path for absolute references.')
  .action((inputPath, outputPath) => {
    validArguments = true;

    const config = {
      definitionsPointer: program.definitionsPointer,
      replaceToken: program.replaceToken,
      defineReferenceToken: program.defineReferenceToken,
      referenceToken: program.referenceToken,
      rootPath: program.rootPath,
    };

    generator.generateToFile(inputPath, outputPath, config).then(() => {
      debug('done');
    }).catch((err) => {
      console.error(err && err.stack || err); // eslint-disable-line no-console
      process.exit(1); // eslint-disable-line no-process-exit
    });
  });

program.parse(process.argv);

if (!validArguments) {
  program.outputHelp();
}
