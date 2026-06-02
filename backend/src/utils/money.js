const DECIMAL_PLACES = 2;
const EPSILON = 0.005;

export const roundMoney = (value) => {
  return Math.round((value || 0) * 100) / 100;
};

export const addMoney = (...values) => {
  return roundMoney(values.reduce((sum, v) => sum + (v || 0), 0));
};

export const sumMoney = (items, fn) => {
  return roundMoney(items.reduce((sum, item) => sum + (fn(item) || 0), 0));
};

export const formatMoney = (value, symbol = '$') => {
  return `${symbol}${(value || 0).toFixed(DECIMAL_PLACES)}`;
};

export const compareMoney = (a, b) => {
  return Math.abs((a || 0) - (b || 0)) < EPSILON;
};

export const gteMoney = (a, b) => {
  return (a || 0) >= (b || 0) - EPSILON;
};

export const lteMoney = (a, b) => {
  return (a || 0) <= (b || 0) + EPSILON;
};
