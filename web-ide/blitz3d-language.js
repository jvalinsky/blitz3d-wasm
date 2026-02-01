/**
 * Blitz3D language definition for Monaco Editor
 * Provides syntax highlighting for Blitz3D BASIC
 */

export function registerBlitz3DLanguage(monaco) {
  // Register the language
  monaco.languages.register({ id: 'blitz3d' });

  // Define syntax highlighting rules
  monaco.languages.setMonarchTokensProvider('blitz3d', {
    defaultToken: '',
    ignoreCase: true,

    keywords: [
      'if', 'then', 'elseif', 'else', 'endif', 'end',
      'for', 'to', 'step', 'next', 'each',
      'while', 'wend',
      'repeat', 'until', 'forever',
      'select', 'case', 'default',
      'function', 'return',
      'type', 'field',
      'local', 'global', 'const', 'dim',
      'new', 'delete', 'first', 'last', 'before', 'after',
      'and', 'or', 'not', 'xor',
      'mod', 'shl', 'shr', 'sar',
      'true', 'false', 'null',
      'goto', 'gosub',
      'data', 'read', 'restore',
      'include',
      'exit'
    ],

    typeKeywords: [
      'integer', 'float', 'string'
    ],

    operators: [
      '=', '>', '<', '<>', '<=', '>=',
      '+', '-', '*', '/', '^',
      '\\', '.', ':'
    ],

    symbols: /[=><!~?:&|+\-*\/\^%\\]+/,

    // Common Blitz3D built-in functions (for highlighting)
    builtins: [
      'print', 'input', 'write', 'read',
      'graphics', 'graphics3d', 'setbuffer', 'flip',
      'createcamera', 'createmesh', 'createsurface', 'createtexture',
      'positionentity', 'rotateentity', 'scaleentity',
      'entityx', 'entityy', 'entityz',
      'renderworld', 'updateworld',
      'loadsound', 'playsound', 'stopsound',
      'loadimage', 'drawimage',
      'createtimer', 'waittimer',
      'millisecs', 'delay',
      'left', 'right', 'mid', 'len', 'instr',
      'upper', 'lower', 'trim', 'replace',
      'chr', 'asc', 'str', 'string',
      'abs', 'sgn', 'int', 'float',
      'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
      'sqr', 'sqrt', 'floor', 'ceil',
      'log', 'exp', 'pow',
      'rand', 'rnd', 'seedrnd'
    ],

    tokenizer: {
      root: [
        // Whitespace
        { include: '@whitespace' },

        // Comments
        [';.*$', 'comment'],

        // Built-in functions
        [/[a-zA-Z_]\w*(?=\()/, {
          cases: {
            '@builtins': 'predefined',
            '@keywords': 'keyword',
            '@default': 'identifier'
          }
        }],

        // Identifiers and keywords
        [/[a-zA-Z_]\w*/, {
          cases: {
            '@typeKeywords': 'keyword.type',
            '@keywords': 'keyword',
            '@builtins': 'predefined',
            '@default': 'identifier'
          }
        }],

        // Type suffixes
        [/%/, 'type'],  // Integer
        [/#/, 'type'],  // Float
        [/\$/, 'type'], // String

        // Numbers
        [/\d+\.\d+([eE][\-+]?\d+)?/, 'number.float'],
        [/\d+/, 'number'],

        // Strings
        [/"([^"\\]|\\.)*$/, 'string.invalid'],  // unclosed string
        [/"/, 'string', '@string'],

        // Operators and punctuation
        [/@symbols/, {
          cases: {
            '@operators': 'operator',
            '@default': ''
          }
        }],

        [/[{}()\[\]]/, '@brackets'],
        [/[,.]/, 'delimiter'],
      ],

      string: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, 'string', '@pop']
      ],

      whitespace: [
        [/[ \t\r\n]+/, 'white'],
      ],
    },
  });

  // Define a custom theme for Blitz3D
  monaco.editor.defineTheme('blitz3d-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'C586C0' },
      { token: 'keyword.type', foreground: '4EC9B0' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'number.float', foreground: 'B5CEA8' },
      { token: 'operator', foreground: 'D4D4D4' },
      { token: 'predefined', foreground: 'DCDCAA' },
      { token: 'type', foreground: '4FC1FF' },
      { token: 'identifier', foreground: '9CDCFE' },
    ],
    colors: {}
  });

  monaco.editor.defineTheme('blitz3d-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '008000', fontStyle: 'italic' },
      { token: 'keyword', foreground: '0000FF', fontStyle: 'bold' },
      { token: 'keyword.type', foreground: '267F99' },
      { token: 'string', foreground: 'A31515' },
      { token: 'number', foreground: '098658' },
      { token: 'number.float', foreground: '098658' },
      { token: 'operator', foreground: '000000' },
      { token: 'predefined', foreground: '795E26' },
      { token: 'type', foreground: '0070C1' },
      { token: 'identifier', foreground: '001080' },
    ],
    colors: {}
  });
}
