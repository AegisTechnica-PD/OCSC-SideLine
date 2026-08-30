import { createContext, useContext } from "react";
export const SeasonCtx = createContext({ seasons: [], season: null, setSeasonId: () => {}, reload: () => {} });
export const useSeason = () => useContext(SeasonCtx);
