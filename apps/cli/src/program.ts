import * as chalk from "chalk";
import { program, Command, OptionValues } from "commander";
import { firstValueFrom } from "rxjs";

import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";

import { LockCommand } from "./auth/commands/lock.command";
import { LoginCommand } from "./auth/commands/login.command";
import { LogoutCommand } from "./auth/commands/logout.command";
import { UnlockCommand } from "./auth/commands/unlock.command";
import { BaseProgram } from "./base-program";
import { CompletionCommand } from "./commands/completion.command";
import { ConfigCommand } from "./commands/config.command";
import { EncodeCommand } from "./commands/encode.command";
import { ServeCommand } from "./commands/serve.command";
import { StatusCommand } from "./commands/status.command";
import { UpdateCommand } from "./commands/update.command";
import { Response } from "./models/response";
import { MessageResponse } from "./models/response/message.response";
import { GenerateCommand } from "./tools/generate.command";
import { CliUtils } from "./utils";
import { SyncCommand } from "./vault/sync.command";

const writeLn = CliUtils.writeLn;

export class Program extends BaseProgram {
  async register() {
    program
      .option("--pretty", "Format output. JSON is tabbed with two spaces.")
      .option("--raw", "Return raw output instead of a descriptive message.")
      .option("--response", "Return a JSON formatted version of response output.")
      .option("--cleanexit", "Exit with a success exit code (0) unless an error is thrown.")
      .option("--quiet", "Don't return anything to stdout.")
      .option("--nointeraction", "Do not prompt for interactive user input.")
      .option("--session <session>", "Pass session key instead of reading from env.")
      .version(
        await this.serviceContainer.platformUtilsService.getApplicationVersion(),
        "-v, --version",
      );

    program.on("option:pretty", () => {
      process.env.BW_PRETTY = "true";
    });

    program.on("option:raw", () => {
      process.env.BW_RAW = "true";
    });

    program.on("option:quiet", () => {
      process.env.BW_QUIET = "true";
    });

    program.on("option:response", () => {
      process.env.BW_RESPONSE = "true";
    });

    program.on("option:cleanexit", () => {
      process.env.BW_CLEANEXIT = "true";
    });

    program.on("option:nointeraction", () => {
      process.env.BW_NOINTERACTION = "true";
    });

    program.on("option:session", async (key) => {
      process.env.BW_SESSION = key;

      // once we have the session key, we can set the user key in memory
      const activeAccount = await firstValueFrom(
        this.serviceContainer.accountService.activeAccount$,
      );
      if (activeAccount) {
        await this.serviceContainer.userAutoUnlockKeyService.setUserKeyInMemoryIfAutoUserKeySet(
          activeAccount.id,
        );
      }
    });

    program.on("command:*", () => {
      writeLn(chalk.redBright("Invalid command: " + program.args.join(" ")), false, true);
      writeLn("See --help for a list of available commands.", true, true);
      process.exitCode = 1;
    });

    program.on("--help", () => {
      writeLn("\n  Examples:");
      writeLn("");
      writeLn("    bw login");
      writeLn("    bw lock");
      writeLn("    bw unlock myPassword321");
      writeLn("    bw list --help");
      writeLn("    bw list items --search google");
      writeLn("    bw get item 99ee88d2-6046-4ea7-92c2-acac464b1412");
      writeLn("    bw get password google.com");
      writeLn('    echo \'{"name":"My Folder"}\' | bw encode');
      writeLn("    bw create folder eyJuYW1lIjoiTXkgRm9sZGVyIn0K");
      writeLn(
        "    bw edit folder c7c7b60b-9c61-40f2-8ccd-36c49595ed72 eyJuYW1lIjoiTXkgRm9sZGVyMiJ9Cg==",
      );
      writeLn("    bw delete item 99ee88d2-6046-4ea7-92c2-acac464b1412");
      writeLn("    bw generate -lusn --length 18");
      writeLn("    bw config server https://bitwarden.example.com");
      writeLn("    bw send -f ./file.ext");
      writeLn('    bw send "text to send"');
      writeLn('    echo "text to send" | bw send');
      writeLn(
        "    bw receive https://vault.bitwarden.com/#/send/rg3iuoS_Akm2gqy6ADRHmg/Ht7dYjsqjmgqUM3rjzZDSQ",
      );
      writeLn("", true);
    });

    program
      .command("login [email] [password]")
      .description("Log into a user account.")
      .option("--method <method>", "Two-step login method.")
      .option("--code <code>", "Two-step login code.")
      .option("--sso", "Log in with Single-Sign On.")
      .option("--apikey", "Log in with an Api Key.")
      .option("--passwordenv <passwordenv>", "Environment variable storing your password")
      .option(
        "--passwordfile <passwordfile>",
        "Path to a file containing your password as its first line",
      )
      .option("--check", "Check login status.", async () => {
        const authed = await this.serviceContainer.stateService.getIsAuthenticated();
        if (authed) {
          const res = new MessageResponse("You are logged in!", null);
          this.processResponse(Response.success(res), true);
        }
        this.processResponse(Response.error("You are not logged in."), true);
      })
      .on("--help", () => {
        writeLn("\n  Notes:");
        writeLn("");
        writeLn("    See docs for valid `method` enum values.");
        writeLn("");
        writeLn("    Pass `--raw` option to only return the session key.");
        writeLn("");
        writeLn("  Examples:");
        writeLn("");
        writeLn("    bw login");
        writeLn("    bw login john@example.com myPassword321 --raw");
        writeLn("    bw login john@example.com myPassword321 --method 1 --code 249213");
        writeLn("    bw login --sso");
        writeLn("", true);
      })
      .action(async (email: string, password: string, options: OptionValues) => {
        if (!options.check) {
          await this.exitIfAuthed();
          const command = new LoginCommand(
            this.serviceContainer.loginStrategyService,
            this.serviceContainer.authService,
            this.serviceContainer.apiService,
            this.serviceContainer.cryptoFunctionService,
            this.serviceContainer.environmentService,
            this.serviceContainer.passwordGenerationService,
            this.serviceContainer.passwordStrengthService,
            this.serviceContainer.platformUtilsService,
            this.serviceContainer.accountService,
            this.serviceContainer.cryptoService,
            this.serviceContainer.policyService,
            this.serviceContainer.twoFactorService,
            this.serviceContainer.syncService,
            this.serviceContainer.keyConnectorService,
            this.serviceContainer.policyApiService,
            this.serviceContainer.organizationService,
            async () => await this.serviceContainer.logout(),
            this.serviceContainer.kdfConfigService,
          );
          const response = await command.run(email, password, options);
          this.processResponse(response, true);
        }
      });

    program
      .command("logout")
      .description("Log out of the current user account.")
      .on("--help", () => {
        writeLn("\n  Examples:");
        writeLn("");
        writeLn("    bw logout");
        writeLn("", true);
      })
      .action(async (cmd) => {
        await this.exitIfNotAuthed();
        const command = new LogoutCommand(
          this.serviceContainer.authService,
          this.serviceContainer.i18nService,
          async () => await this.serviceContainer.logout(),
        );
        const response = await command.run();
        this.processResponse(response);
      });

    program
      .command("lock")
      .description("Lock the vault and destroy active session keys.")
      .on("--help", () => {
        writeLn("\n  Examples:");
        writeLn("");
        writeLn("    bw lock");
        writeLn("", true);
      })
      .action(async (cmd) => {
        await this.exitIfNotAuthed();

        if (await this.serviceContainer.keyConnectorService.getUsesKeyConnector()) {
          const logoutCommand = new LogoutCommand(
            this.serviceContainer.authService,
            this.serviceContainer.i18nService,
            async () => await this.serviceContainer.logout(),
          );
          await logoutCommand.run();
          this.processResponse(
            Response.error(
              "You cannot lock your vault because you are using Key Connector. " +
                "To protect your vault, you have been logged out.",
            ),
            true,
          );
          return;
        }

        const command = new LockCommand(this.serviceContainer.vaultTimeoutService);
        const response = await command.run();
        this.processResponse(response);
      });

    program
      .command("unlock [password]")
      .description("Unlock the vault and return a new session key.")
      .on("--help", () => {
        writeLn("\n  Notes:");
        writeLn("");
        writeLn("    After unlocking, any previous session keys will no longer be valid.");
        writeLn("");
        writeLn("    Pass `--raw` option to only return the session key.");
        writeLn("");
        writeLn("  Examples:");
        writeLn("");
        writeLn("    bw unlock");
        writeLn("    bw unlock myPassword321");
        writeLn("    bw unlock myPassword321 --raw");
        writeLn("", true);
      })
      .option("--check", "Check lock status.", async () => {
        await this.exitIfNotAuthed();

        const authStatus = await this.serviceContainer.authService.getAuthStatus();
        if (authStatus === AuthenticationStatus.Unlocked) {
          const res = new MessageResponse("Vault is unlocked!", null);
          this.processResponse(Response.success(res), true);
        } else {
          this.processResponse(Response.error("Vault is locked."), true);
        }
      })
      .option("--passwordenv <passwordenv>", "Environment variable storing your password")
      .option(
        "--passwordfile <passwordfile>",
        "Path to a file containing your password as its first line",
      )
      .action(async (password, cmd) => {
        if (!cmd.check) {
          await this.exitIfNotAuthed();
          const command = new UnlockCommand(
            this.serviceContainer.accountService,
            this.serviceContainer.masterPasswordService,
            this.serviceContainer.cryptoService,
            this.serviceContainer.userVerificationService,
            this.serviceContainer.cryptoFunctionService,
            this.serviceContainer.logService,
            this.serviceContainer.keyConnectorService,
            this.serviceContainer.environmentService,
            this.serviceContainer.syncService,
            this.serviceContainer.organizationApiService,
            async () => await this.serviceContainer.logout(),
          );
          const response = await command.run(password, cmd);
          this.processResponse(response);
        }
      });

    program
      .command("sync")
      .description("Pull the latest vault data from server.")
      .option("-f, --force", "Force a full sync.")
      .option("--last", "Get the last sync date.")
      .on("--help", () => {
        writeLn("\n  Examples:");
        writeLn("");
        writeLn("    bw sync");
        writeLn("    bw sync -f");
        writeLn("    bw sync --last");
        writeLn("", true);
      })
      .action(async (cmd) => {
        await this.exitIfNotAuthed();
        const command = new SyncCommand(this.serviceContainer.syncService);
        const response = await command.run(cmd);
        this.processResponse(response);
      });

    program
      .command("generate")
      .description("Generate a password/passphrase.")
      .option("-u, --uppercase", "Include uppercase characters.")
      .option("-l, --lowercase", "Include lowercase characters.")
      .option("-n, --number", "Include numeric characters.")
      .option("-s, --special", "Include special characters.")
      .option("-p, --passphrase", "Generate a passphrase.")
      .option("--length <length>", "Length of the password.")
      .option("--words <words>", "Number of words.")
      .option("--minNumber <count>", "Minimum number of numeric characters.")
      .option("--minSpecial <count>", "Minimum number of special characters.")
      .option("--separator <separator>", "Word separator.")
      .option("-c, --capitalize", "Title case passphrase.")
      .option("--includeNumber", "Passphrase includes number.")
      .option("--ambiguous", "Avoid ambiguous characters.")
      .on("--help", () => {
        writeLn("\n  Notes:");
        writeLn("");
        writeLn("    Default options are `-uln --length 14`.");
        writeLn("");
        writeLn("    Minimum `length` is 5.");
        writeLn("");
        writeLn("    Minimum `words` is 3.");
        writeLn("");
        writeLn("  Examples:");
        writeLn("");
        writeLn("    bw generate");
        writeLn("    bw generate -u -l --length 18");
        writeLn("    bw generate -ulns --length 25");
        writeLn("    bw generate -ul");
        writeLn("    bw generate -p --separator _");
        writeLn("    bw generate -p --words 5 --separator space");
        writeLn("    bw generate -p --words 5 --separator empty");
        writeLn("", true);
      })
      .action(async (options) => {
        const command = new GenerateCommand(
          this.serviceContainer.passwordGenerationService,
          this.serviceContainer.stateService,
        );
        const response = await command.run(options);
        this.processResponse(response);
      });

    program
      .command("encode")
      .description("Base 64 encode stdin.")
      .on("--help", () => {
        writeLn("\n  Notes:");
        writeLn("");
        writeLn("    Use to create `encodedJson` for `create` and `edit` commands.");
        writeLn("");
        writeLn("  Examples:");
        writeLn("");
        writeLn('    echo \'{"name":"My Folder"}\' | bw encode');
        writeLn("", true);
      })
      .action(async () => {
        const command = new EncodeCommand();
        const response = await command.run();
        this.processResponse(response);
      });

    program
      .command("config <setting> [value]")
      .description("Configure CLI settings.")
      .option(
        "--web-vault <url>",
        "Provides a custom web vault URL that differs from the base URL.",
      )
      .option("--api <url>", "Provides a custom API URL that differs from the base URL.")
      .option("--identity <url>", "Provides a custom identity URL that differs from the base URL.")
      .option(
        "--icons <url>",
        "Provides a custom icons service URL that differs from the base URL.",
      )
      .option(
        "--notifications <url>",
        "Provides a custom notifications URL that differs from the base URL.",
      )
      .option("--events <url>", "Provides a custom events URL that differs from the base URL.")
      .option("--key-connector <url>", "Provides the URL for your Key Connector server.")
      .on("--help", () => {
        writeLn("\n  Settings:");
        writeLn("");
        writeLn("    server - On-premises hosted installation URL.");
        writeLn("");
        writeLn("  Examples:");
        writeLn("");
        writeLn("    bw config server");
        writeLn("    bw config server https://bw.company.com");
        writeLn("    bw config server bitwarden.com");
        writeLn(
          "    bw config server --api http://localhost:4000 --identity http://localhost:33656",
        );
        writeLn("", true);
      })
      .action(async (setting, value, options) => {
        const command = new ConfigCommand(this.serviceContainer.environmentService);
        const response = await command.run(setting, value, options);
        this.processResponse(response);
      });

    program
      .command("update")
      .description("Check for updates.")
      .on("--help", () => {
        writeLn("\n  Notes:");
        writeLn("");
        writeLn("    Returns the URL to download the newest version of this CLI tool.");
        writeLn("");
        writeLn("    Use the `--raw` option to return only the download URL for the update.");
        writeLn("");
        writeLn("  Examples:");
        writeLn("");
        writeLn("    bw update");
        writeLn("    bw update --raw");
        writeLn("", true);
      })
      .action(async () => {
        const command = new UpdateCommand(this.serviceContainer.platformUtilsService);
        const response = await command.run();
        this.processResponse(response);
      });

    program
      .command("completion")
      .description("Generate shell completions.")
      .option("--shell <shell>", "Shell to generate completions for.")
      .on("--help", () => {
        writeLn("\n  Notes:");
        writeLn("");
        writeLn("    Valid shells are `zsh`.");
        writeLn("");
        writeLn("  Examples:");
        writeLn("");
        writeLn("    bw completion --shell zsh");
        writeLn("", true);
      })
      .action(async (options: OptionValues, cmd: Command) => {
        const command = new CompletionCommand();
        const response = await command.run(options);
        this.processResponse(response);
      });

    program
      .command("status")
      .description("Show server, last sync, user information, and vault status.")
      .on("--help", () => {
        writeLn("");
        writeLn("");
        writeLn("  Example return value:");
        writeLn("");
        writeLn("    {");
        writeLn('      "serverUrl": "https://bitwarden.example.com",');
        writeLn('      "lastSync": "2020-06-16T06:33:51.419Z",');
        writeLn('      "userEmail": "user@example.com,');
        writeLn('      "userId": "00000000-0000-0000-0000-000000000000",');
        writeLn('      "status": "locked"');
        writeLn("    }");
        writeLn("");
        writeLn("  Notes:");
        writeLn("");
        writeLn("  `status` is one of:");
        writeLn("    - `unauthenticated` when you are not logged in");
        writeLn("    - `locked` when you are logged in and the vault is locked");
        writeLn("    - `unlocked` when you are logged in and the vault is unlocked");
        writeLn("", true);
      })
      .action(async () => {
        const command = new StatusCommand(
          this.serviceContainer.environmentService,
          this.serviceContainer.syncService,
          this.serviceContainer.accountService,
          this.serviceContainer.authService,
        );
        const response = await command.run();
        this.processResponse(response);
      });

    program
      .command("serve")
      .description("Start a RESTful API webserver.")
      .option("--hostname <hostname>", "The hostname to bind your API webserver to.")
      .option("--port <port>", "The port to run your API webserver on.")
      .option(
        "--disable-origin-protection",
        "If set, allows requests with origin header. Warning, this option exists for backwards compatibility reasons and exposes your environment to known CSRF attacks.",
      )
      .on("--help", () => {
        writeLn("\n  Notes:");
        writeLn("");
        writeLn("    Default hostname is `localhost`.");
        writeLn("    Use hostname `all` for no hostname binding.");
        writeLn("    Default port is `8087`.");
        writeLn("");
        writeLn("  Examples:");
        writeLn("");
        writeLn("    bw serve");
        writeLn("    bw serve --port 8080");
        writeLn("    bw serve --hostname bwapi.mydomain.com --port 80");
        writeLn("", true);
      })
      .action(async (cmd) => {
        await this.exitIfNotAuthed();
        const command = new ServeCommand(this.serviceContainer);
        await command.run(cmd);
      });
  }
}
