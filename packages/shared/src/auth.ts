/** Regras de conta que a API valida e as telas precisam anunciar igual. */

/**
 * Mínimo de caracteres de uma senha, em todo lugar que aceita uma: cadastro,
 * conta criada por admin, troca de senha, redefinição e o seed do primeiro
 * admin.
 *
 * Estava escrito em sete lugares, e o seed pedia dez enquanto o resto do
 * sistema aceitava seis — quem seguia o README do deploy escolhia uma senha
 * que nenhuma outra tela exigiria.
 */
export const MIN_PASSWORD_LENGTH = 6
