// validation tools
import { anyPass, isEmpty, isNil } from "ramda";

/**
 * Returns `true` if the given value is its type's empty value, `null` or `undefined`.
 *
 * @func isNilOrEmpty
 * @memberOf Validator
 * @category Validator
 * @sig * -> Boolean
 * @param {*} val The value to test
 * @return {Boolean}
 * @see {@link http://ramdajs.com/docs/#isEmpty|isEmpty}, {@link http://ramdajs.com/docs/#isNil|isNil}
 * @example
 *
 * Validator.isNilOrEmpty([1, 2, 3]); //=> false
 * Validator.isNilOrEmpty([]); //=> true
 * Validator.isNilOrEmpty(''); //=> true
 * Validator.isNilOrEmpty(null); //=> true
 * Validator.isNilOrEmpty(undefined): //=> true
 * Validator.isNilOrEmpty({}); //=> true
 * Validator.isNilOrEmpty({length: 0}); //=> false
 */
export const isNilOrEmpty = anyPass([isNil, isEmpty]);
export const isArrayNotEmpty = (array) => {
  return Array.isArray(array) && !isNilOrEmpty(array) && array.length > 0;
};

export const addToLocalStorage = (key, value) => {
  localStorage.setItem(key, value);
};

export const getFromLocalStorage = (key) => {
  return localStorage.getItem(key);
};

export const removeFromLocalStorage = (key) => {
  localStorage.removeItem(key);
};

/**
 * Removes every key from `localStorage`.
 *
 * @returns {string[]} The keys that were purged.
 */
export const purgeLocalStorage = () => {
  const keys = Object.keys(localStorage);
  localStorage.clear();
  return keys;
};

export const isJsonValid = (json) => {
  try {
    JSON.parse(json);
    return true;
  } catch (_error) {
    return false;
  }
};
