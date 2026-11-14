import { initSqliteDb } from "../scripts/db-init";

export default function setup() {
  initSqliteDb("file:./test.db", { reset: true });
}
