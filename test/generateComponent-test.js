'use strict';

const path = require('path');
const assert = require('assert');

const generator = require('../lib/generator.js');

describe('generateComponent', () => {
  describe('single file', () => {
    const targetResult = { test: 1, testt: 2 };

    it('should generate single yaml file', function * () {
      const filePath = path.resolve(__dirname, './resources/singleFile/singleFile.yaml');
      const config = {
        definitionsPointer: '/definitions',
        replaceToken: '$x-r-ref',
        defineReferenceToken: '$x-d-ref',
        referenceToken: '$ref',

        rootPath: path.dirname(filePath),
        cache: {},
      };
      const result = yield generator.generateComponent(config, filePath);

      assert.deepEqual(result, targetResult);
    });

    it('should generate single json file', function * () {
      const filePath = path.resolve(__dirname, './resources/singleFile/singleFile.json');
      const config = {
        definitionsPointer: '/definitions',
        replaceToken: '$x-r-ref',
        defineReferenceToken: '$x-d-ref',
        referenceToken: '$ref',

        rootPath: path.dirname(filePath),
        cache: {},
      };
      const result = yield generator.generateComponent(config, filePath);

      assert.deepEqual(result, targetResult);
    });
  });

  describe('mixed reference', () => {
    const targetResult = { jsonRef: { json: true }, yamlRef: { yaml: true } };

    it('should include refs', function * () {
      const filePath = path.resolve(__dirname, './resources/mixedReference/mixedReference.yaml');
      const config = {
        definitionsPointer: '/definitions',
        replaceToken: '$x-r-ref',
        defineReferenceToken: '$x-d-ref',
        referenceToken: '$ref',

        rootPath: path.dirname(filePath),
        cache: {},
      };
      const result = yield generator.generateComponent(config, filePath);

      assert.deepEqual(result, targetResult);
    });
  });

  describe('defineReference', () => {
    const targetResult = { jsonRef: { $ref: '#/definitions/ref' }, yamlRef: { $ref: '#/definitions/ref-1' }, definitions: { ref: { json: true }, 'ref-1': { yaml: true } } };

    it('should define and include refs', function * () {
      const filePath = path.resolve(__dirname, './resources/defineReference/defineReference.yaml');
      const config = {
        definitionsPointer: '/definitions',
        replaceToken: '$x-r-ref',
        defineReferenceToken: '$x-d-ref',
        referenceToken: '$ref',

        rootPath: path.dirname(filePath),
        cache: {},
      };
      const result = yield generator.generateComponent(config, filePath);

      assert.deepEqual(result, targetResult);
    });
  });
});
