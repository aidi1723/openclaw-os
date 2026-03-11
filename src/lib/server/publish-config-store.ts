import { defaultSettings, normalizeMatrixAccountsSettings, type MatrixAccountsSettings } from "@/lib/settings";
import { readJsonFile, writeJsonFile } from "@/lib/server/json-store";

const FILE_NAME = "publish-config.json";

export async function readPublishConfig(): Promise<MatrixAccountsSettings> {
  const raw = await readJsonFile<Partial<MatrixAccountsSettings>>(FILE_NAME, defaultSettings.matrixAccounts);
  return normalizeMatrixAccountsSettings(raw);
}

export async function writePublishConfig(next: Partial<MatrixAccountsSettings> | MatrixAccountsSettings) {
  const normalized = normalizeMatrixAccountsSettings(next);
  await writeJsonFile(FILE_NAME, normalized);
  return normalized;
}
