{
  inputs = {
    nixpkgs.url = "https://flakehub.com/f/NixOS/nixpkgs/0.1";
  };
  outputs =
    inputs:
    let
      supportedSystems = [
        "aarch64-darwin"
        "x86_64-linux"
      ];

      forAllSystems = forSystems supportedSystems;

      forSystems =
        s: f:
        inputs.nixpkgs.lib.genAttrs s (
          system:
          f rec {
            inherit system;
            pkgs = import inputs.nixpkgs {
              inherit system;
              overlays = [ inputs.self.overlays.default ];
            };
          }
        );
    in
    {
      overlays.default = final: prev: {
        inherit (final.stdenv.hostPlatform) system;
      };

      devShells = forAllSystems (
        { pkgs, ... }:
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              corepack
              nodejs
              flyctl
              twitch-cli
            ];
          };
        }
      );
    };
}
