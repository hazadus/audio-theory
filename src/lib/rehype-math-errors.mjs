// Останавливает сборку, если rehype-katex не смог отрендерить формулу.
// rehype-katex записывает ошибки в VFile, но сам не останавливает сборку.
export default function rehypeMathErrors() {
  return (_tree, file) => {
    const error = file.messages.find((message) => message.source === 'rehype-katex');
    if (error) {
      file.fail(`Неверная формула: ${error.cause?.message ?? error.message}`, error.place);
    }
  };
}
