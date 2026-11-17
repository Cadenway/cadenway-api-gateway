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
