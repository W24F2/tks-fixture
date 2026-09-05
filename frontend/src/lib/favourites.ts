const FAVOURITES_KEY = 'sf_favourites';

export function getFavourites(): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(FAVOURITES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addFavourite(fixtureId: number): void {
  if (typeof window === 'undefined') return;
  const favourites = getFavourites();
  if (!favourites.includes(fixtureId)) {
    favourites.push(fixtureId);
    localStorage.setItem(FAVOURITES_KEY, JSON.stringify(favourites));
  }
}

export function removeFavourite(fixtureId: number): void {
  if (typeof window === 'undefined') return;
  const favourites = getFavourites().filter((id) => id !== fixtureId);
  localStorage.setItem(FAVOURITES_KEY, JSON.stringify(favourites));
}

export function toggleFavourite(fixtureId: number): boolean {
  const favourites = getFavourites();
  const isFavourite = favourites.includes(fixtureId);
  if (isFavourite) {
    removeFavourite(fixtureId);
  } else {
    addFavourite(fixtureId);
  }
  return !isFavourite;
}

export function isFavourite(fixtureId: number): boolean {
  return getFavourites().includes(fixtureId);
}