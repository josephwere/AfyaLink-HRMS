export const validateEmail = (email) => {
  const re = /^(([^<>()\\[\\]\\.,;:\s@"]+(\.[^<>()\\[\\]\\.,;:\s@"]+)*)|(".+"))@(([^<>()[\\]\\.,;:\s@"]+\.)+[^<>()[\\]\\.,;:\s@"]{2,})$/i;
  return re.test(String(email).toLowerCase());
};
