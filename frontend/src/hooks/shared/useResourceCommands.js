import { useCallback } from "react";
import { useMutation } from "./useMutation";

export function useResourceCommands({ commands = {}, invalidate }) {
  return Object.keys(commands).reduce((acc, key) => {
    const commandFn = commands[key];
    const mutation = useMutation({
      action: commandFn,
      invalidate,
    });
    acc[key] = mutation;
    return acc;
  }, {});
}
