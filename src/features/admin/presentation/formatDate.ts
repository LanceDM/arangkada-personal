export const toDateTime = (value: number | undefined) => {
  if (!value) return '-';
  return new Date(value).toLocaleString();
};
