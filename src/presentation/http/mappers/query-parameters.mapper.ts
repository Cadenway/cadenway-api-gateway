/**
 * Constant INTEGER_TEXT
 *
 * @description
 * A whole number as a query string writes it: digits only, no sign, no exponent.
 *
 * @type {RegExp}
 */
const INTEGER_TEXT: RegExp = /^\d{1,15}$/u;

/**
 * Function toQueryInteger
 *
 * @description
 * Reads an integer query parameter (`limit=20`) before the validator of the contract checks it:
 * a query string carries text, the contract an integer. Anything that is not plain digits is
 * left as it is, so the validator refuses it with `400 request.invalid`.
 *
 * @param {unknown} value - The parameter as Express parsed it.
 * @returns {unknown} The number, or the value unchanged.
 */
export function toQueryInteger(value: unknown): unknown {
  return typeof value === 'string' && INTEGER_TEXT.test(value) ? Number(value) : value;
}

/**
 * Function toQueryList
 *
 * @description
 * Reads an array query parameter of `style: form, explode: false` (`role=owner,admin`) before the
 * validator of the contract checks it: the text is split on commas. Anything else is left as it
 * is for the validator.
 *
 * @param {unknown} value - The parameter as Express parsed it.
 * @returns {unknown} The list, or the value unchanged.
 */
export function toQueryList(value: unknown): unknown {
  return typeof value === 'string' ? value.split(',') : value;
}
