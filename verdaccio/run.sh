# export BASE_PATH="/var/lib/docker/volumes/dowo0cwkww0swc0kg0wgw44k_vibe-kanban-worktrees/_data/e1e4-copy-jamtools-fe/springboard/verdaccio"
# VERDACCIO_CONFIG_PATH="$BASE_PATH/config" \
# VERDACCIO_STORAGE_PATH="$BASE_PATH/storage" \
# VERDACCIO_PLUGINS_PATH="$BASE_PATH/plugins" \
# docker compose up

echo "registry=http://localhost:4873/" >> ../.npmrc
echo "//localhost:4873/:_authToken=fake" >> ../.npmrc

npx verdaccio --config ./config/config.yaml

# curl -L -o $HOME/bin/jq https://github.com/jqlang/jq/releases/latest/download/jq-linux64
# chmod +x "$HOME/bin/jq"
# export PATH=$PATH:$HOME/bin

# export npm_config__authToken=fake
# export npm_config_registry=http://localhost:4873/
# ./scripts/run-all-folders.sh 0.0.1-dev-jamapp-3

