const ADJ = ['swift', 'quiet', 'brave', 'bright', 'lone', 'cool', 'eager', 'lucky', 'jolly', 'mighty'];
const NOUN = ['otter', 'fox', 'walrus', 'newt', 'deer', 'cat', 'lynx', 'hawk', 'crow', 'wolf'];
const rand = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
export const generateSlug = () =>
  `${rand(ADJ)}-${rand(NOUN)}-${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`;
