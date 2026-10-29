import { main } from "./main";

main(process.argv.slice(2), {
  dataDir: process.env.PF_DATA_DIR ?? process.cwd(),
  out: (line) => console.log(line),
  err: (line) => console.error(line),
}).then((code) => process.exit(code));
