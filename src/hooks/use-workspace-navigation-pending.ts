import { createContext, useContext } from "react";

export const WorkspaceNavigationPendingContext = createContext(false);
export const useWorkspaceNavigationPending = () => useContext(WorkspaceNavigationPendingContext);
