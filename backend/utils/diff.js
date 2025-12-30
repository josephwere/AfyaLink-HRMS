export const diffObjects = (before = {}, after = {}) => {
  const diff = {};

  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      diff[key] = {
        before: before[key],
        after: after[key],
      };
    }
  }

  return diff;
};
