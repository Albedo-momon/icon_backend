export const logger = {
  info: (obj: any, msg?: string) => {
    if (msg) console.info(msg, obj);
    else console.info(obj);
  },
  error: (obj: any, msg?: string) => {
    if (msg) console.error(msg, obj);
    else console.error(obj);
  },
  warn: (obj: any, msg?: string) => {
    if (msg) console.warn(msg, obj);
    else console.warn(obj);
  },
  debug: (obj: any, msg?: string) => {
    if (msg) console.debug(msg, obj);
    else console.debug(obj);
  },
};