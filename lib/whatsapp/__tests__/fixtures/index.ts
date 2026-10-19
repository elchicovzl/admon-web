import audio from "./audio.json"
import echo from "./echo.json"
import image from "./image.json"
import malformed from "./malformed.json"
import multiEntry from "./multi-entry.json"
import statusDelivered from "./status-delivered.json"
import statusFailed from "./status-failed.json"
import statusRead from "./status-read.json"
import statusSent from "./status-sent.json"
import text from "./text.json"
import unknown from "./unknown.json"
import unsupported from "./unsupported.json"

export const fixtures = {
  text,
  audio,
  image,
  statusSent,
  statusDelivered,
  statusRead,
  statusFailed,
  echo,
  unsupported,
  unknown,
  multiEntry,
  malformed,
}
