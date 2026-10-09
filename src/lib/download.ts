/** Dispara o download de um arquivo gerado no navegador (sem passar por um link do servidor). */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Dá tempo ao navegador de começar o download antes de liberar a URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Salva dados como JSON indentado. As exportações da API exigem o token no header, então não dá
 * para usar um `<a href>` direto: o front busca os dados autenticado e gera o arquivo aqui.
 * (O nome vem do front: a API não expõe o `Content-Disposition` no CORS.)
 */
export function saveJson(data: unknown, filename: string) {
  saveBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), filename);
}
