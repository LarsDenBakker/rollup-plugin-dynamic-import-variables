const path = require('path');

class VariablyDynamicImportError extends Error {}

const example = 'For example: import(`./foo/${bar}.js`).';

function sanitizeString(str) {
  if (str.includes('*')) {
    throw new VariablyDynamicImportError(
      'A dynamic import cannot contain * characters.'
    );
  }
  return str;
}

function templateLiteralToGlob(node) {
  let glob = '';

  for (let i = 0; i < node.quasis.length; i += 1) {
    glob += sanitizeString(node.quasis[i].value.raw);
    if (node.expressions[i]) {
      glob += expressionToGlob(node.expressions[i]);
    }
  }

  return glob;
}

function binaryExpressionToGlob(node) {
  if (node.operator !== '+') {
    throw new VariablyDynamicImportError(
      `${node.operator} operator is not supported.`
    );
  }

  return `${expressionToGlob(node.left)}${expressionToGlob(node.right)}`;
}

function expressionToGlob(node) {
  switch (node.type) {
    case 'TemplateLiteral':
      return templateLiteralToGlob(node);
    case 'BinaryExpression':
      return binaryExpressionToGlob(node);
    case 'Identifier':
      return '*';
    case 'Literal': {
      return sanitizeString(node.value);
    }
    default:
      throw new VariablyDynamicImportError(
        `Unsupported expression, found node type ${node.type}.`
      );
  }
}

function dynamicImportToGlob(node, sourceString) {
  let glob = expressionToGlob(node);
  if (!glob.includes('*')) {
    return null;
  }
  glob = glob.replace(/\*\*/g, '*');

  if (glob.startsWith('*')) {
    throw new VariablyDynamicImportError(
      `invalid import "${sourceString}". It cannot be statically analyzed. Variable dynamic imports must start with ./ and be limited to a specific directory. ` +
        example
    );
  }

  if (glob.startsWith('/')) {
    throw new VariablyDynamicImportError(
      `invalid import "${sourceString}". Variable absolute imports are not supported, imports must start with ./ in the static part of the import. ` +
        example
    );
  }

  if (!glob.startsWith('./') && !glob.startsWith('../')) {
    throw new VariablyDynamicImportError(
      `invalid import "${sourceString}". Variable bare imports are not supported, imports must start with ./ in the static part of the import. ` +
        example
    );
  }

  if (glob.startsWith('./*.')) {
    throw new VariablyDynamicImportError(
      `invalid import "${sourceString}". Variable imports cannot import their own directory, ` +
        'place imports in a separate directory or make the import filename more specific. ' +
        example
    );
  }

  if (path.extname(glob) === '') {
    throw new VariablyDynamicImportError(
      `invalid import "${sourceString}". A file extension must be included in the static part of the import. ` +
        example
    );
  }

  return glob;
}

module.exports = { dynamicImportToGlob, VariablyDynamicImportError };
