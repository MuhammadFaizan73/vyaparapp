import * as SecureStore from "expo-secure-store";
import { VyaparApiClient } from "@vyapar/api-client";

const TOKEN_KEY = "vyapar_jwt";
const API_BASE = "http://192.168.1.2:3000/api";

export const api = new VyaparApiClient(API_BASE);

export async function loadToken(): Promise<string | null> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) api.setToken(token);
  return token;
}

export async function saveToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  api.setToken(token);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  api.clearToken();
}
