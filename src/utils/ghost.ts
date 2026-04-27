/**
 * Ghost emoji helper for consistent branding across Poltergeist
 *
 * Note: Emoji characters cannot be colored in terminals.
 * Use the plain ghost emoji and color the text instead:
 *
 * Example:
 *   console.log(`👻 ${chalk.cyan('Poltergeist is running')}`);
 *
 * NOT:
 *   console.log(chalk.cyan('👻 Poltergeist is running'));
 */

/**
 * Ghost emoji helper - returns plain emoji since terminals can't color emoji
 * @deprecated Use ghost.plain() and color your text instead
 */
export const ghost = {
  /**
   * @deprecated Use ghost.plain() with chalk.cyan() on your text
   */
  brand: () => "👻",

  /**
   * @deprecated Use ghost.plain() with chalk.green() on your text
   */
  success: () => "👻",

  /**
   * @deprecated Use ghost.plain() with chalk.yellow() on your text
   */
  warning: () => "👻",

  /**
   * @deprecated Use ghost.plain() with chalk.red() on your text
   */
  error: () => "👻",

  /**
   * @deprecated Use ghost.plain() with chalk.gray() on your text
   */
  info: () => "👻",

  /**
   * Plain ghost emoji - use this and color your text instead
   */
  plain: () => "👻",
} as const;

/**
 * Format a Poltergeist message with appropriate ghost color
 * @param type - The message type determining ghost color
 * @param message - The message content (without [Poltergeist] prefix)
 * @returns Formatted message with colored ghost and [Poltergeist] prefix
 */
export function poltergeistMessage(type: keyof typeof ghost, message: string): string {
  return `${ghost[type]()} [Poltergeist] ${message}`;
}
