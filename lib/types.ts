export type ActionResponse = {
  success: boolean;
  message?: string;
  error?: string;
  payload?: FormData;
};

export const initialState: ActionResponse = {
  success: false,
  message: "",
  error: undefined,
  payload: undefined,
};
