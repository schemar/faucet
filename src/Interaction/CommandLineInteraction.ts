import * as inquirer from 'inquirer';

import Interaction from "../Interaction";

/**
 * Interaction implementation that requests user input from the command line.
 */
export default class CommandLineInteraction implements Interaction {
  /**
   * Asks the user for a hidden input and returns it.
   */
  public async inquirePassword(): Promise<string> {
    const input = await inquirer.prompt({
      type: 'password',
      name: 'password',
      message: `Input your account password:`,
    });

    return input.password;
  }

  /**
   * Asks the user for a hidden password and then again for the same password. Makes sure both
   * passwords match. Returns the matching password.
   */
  public async inquireNewPassword(): Promise<string> {
    const firstInput: any = await inquirer.prompt({
      type: 'password',
      name: 'password',
      message: 'Select a password to encrypt the account:',
    });

    await inquirer.prompt({
      type: 'password',
      name: 'password',
      message: 'Repeat the password:',
      validate: (input) => {
        if (input === firstInput.password) {
          return true;
        } else {
          return 'Passwords don\'t match, please try again. (^C to abort)';
        }
      },
    });

    return firstInput.password;
  }
}
