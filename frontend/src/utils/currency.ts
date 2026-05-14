export const formatVnd = (amount: number): string =>
  `${Math.round(amount).toLocaleString('vi-VN')} đ`
