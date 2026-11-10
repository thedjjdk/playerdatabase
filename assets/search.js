window.PlayerDatabaseSearch = query => {
  const normalize = text => text.normalize('NFD').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const letters = Array.from(normalize(query));
  return name => {
    let matched = 0;
    for (const letter of normalize(name)) if (letter === letters[matched]) matched++;
    return matched === letters.length;
  };
};
