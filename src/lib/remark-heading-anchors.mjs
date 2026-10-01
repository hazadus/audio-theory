// Поддерживает `## Заголовок {#english-anchor}`: явный якорь становится id заголовка и не попадает в текст.
// Без расширения MDX читает `{#…}` как выражение JavaScript и останавливает сборку.
// Из текста заголовка якорь убирается, поэтому переименование русского заголовка id не меняет.

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Конструкция micromark: `{#…}` до закрывающей скобки в одной строке. */
const headingAnchorConstruct = {
  name: 'headingAnchor',
  tokenize(effects, ok, nok) {
    return start;

    function start(code) {
      if (code !== 123) return nok(code);
      effects.enter('headingAnchor');
      effects.consume(code);
      return hash;
    }

    function hash(code) {
      if (code !== 35) return nok(code);
      effects.consume(code);
      return body;
    }

    function body(code) {
      if (code === 125) {
        effects.consume(code);
        effects.exit('headingAnchor');
        return ok;
      }
      // Конец строки или файла до `}`: оставляем выражению MDX, оно сообщит о синтаксической ошибке.
      if (code === null || code === -5 || code === -4 || code === -3) return nok(code);
      effects.consume(code);
      return body;
    }
  },
};

const syntax = { text: { 123: headingAnchorConstruct } };

const fromMarkdown = {
  enter: {
    headingAnchor(token) {
      this.enter({ type: 'headingAnchor', value: '' }, token);
    },
  },
  exit: {
    headingAnchor(token) {
      const node = this.stack[this.stack.length - 1];
      node.value = this.sliceSerialize(token).slice(2, -1);
      this.exit(token);
    },
  },
};

function isBlank(node) {
  return node.type === 'text' && node.value.trim() === '';
}

export default function remarkHeadingAnchors() {
  const data = this.data();
  (data.micromarkExtensions ??= []).push(syntax);
  (data.fromMarkdownExtensions ??= []).push(fromMarkdown);

  return function transform(tree, file) {
    const used = new Map();

    function fail(message, node) {
      file.fail(message, node.position);
    }

    function applyAnchor(heading) {
      const children = heading.children;
      let last = children.length - 1;
      while (last >= 0 && isBlank(children[last])) last -= 1;
      const node = children[last];
      if (node?.type !== 'headingAnchor') return;

      const id = node.value;
      if (!idPattern.test(id)) {
        fail(`Якорь «${id}» не в формате английского kebab-case: [a-z0-9] через дефис`, node);
      }
      if (used.has(id)) fail(`Повторный якорь «${id}»`, node);
      used.set(id, node);

      children.length = last;
      const previous = children[last - 1];
      if (previous?.type === 'text') previous.value = previous.value.trimEnd();
      heading.data = { ...heading.data, hProperties: { ...heading.data?.hProperties, id } };
    }

    function walk(node) {
      if (node.type === 'heading') applyAnchor(node);
      for (const child of node.children ?? []) {
        if (child.type === 'headingAnchor') {
          fail('Якорь `{#…}` допустим только в конце заголовка', child);
        }
        walk(child);
      }
    }
    walk(tree);
  };
}
