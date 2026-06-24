import { useEffect, useState } from 'react';

const MOBILE_QUERY = '(max-width: 760px)';

export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== 'undefined'
      ? window.matchMedia(MOBILE_QUERY).matches
      : false
  ));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(mediaQuery.matches);
    update();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', update);
      return () => mediaQuery.removeEventListener('change', update);
    }

    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);

  return isMobile;
}
