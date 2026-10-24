import { createContext, useContext } from 'react';

// The origin shown in code samples. The prerenderer supplies the canonical origin; in the
// browser it is the page's own origin, so a sample always points at the host serving it.
const OriginContext = createContext('https://example.com');

export const OriginProvider = OriginContext.Provider;
export const useOrigin = () => useContext(OriginContext);

export const fillOrigin = (text, origin) => text.replaceAll('{{API}}', origin);
