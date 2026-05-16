.PHONY: build test clean deploy

# Build the program
build:
	anchor build

# Run all tests
test:
	anchor test

# Clean build artifacts
clean:
	anchor clean

# Deploy to devnet
deploy-devnet:
	anchor deploy --provider.cluster devnet

# Deploy to mainnet (with confirmation)
deploy-mainnet:
	@echo "WARNING: Deploying to mainnet!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		anchor deploy --provider.cluster mainnet; \
	fi

# Initialize IDL
idl-init:
	anchor idl init --filepath target/idl/calibration.json $(PROGRAM_ID)

# Upgrade IDL
idl-upgrade:
	anchor idl upgrade --filepath target/idl/calibration.json $(PROGRAM_ID)

# Start local validator
localnet:
	solana-test-validator

# Verify build (deterministic)
verify:
	anchor build --verifiable

# Show program address
show-address:
	@solana address -k target/deploy/calibration-keypair.json

# Install dependencies
install:
	npm install

# Format Rust code
format:
	cd programs/calibration && cargo fmt

# Lint Rust code
lint:
	cd programs/calibration && cargo clippy -- -D warnings

# Help
help:
	@echo "Available commands:"
	@echo "  make build          - Build the program"
	@echo "  make test           - Run tests"
	@echo "  make clean          - Clean build artifacts"
	@echo "  make deploy-devnet  - Deploy to devnet"
	@echo "  make deploy-mainnet - Deploy to mainnet (interactive)"
	@echo "  make verify         - Verify deterministic build"
	@echo "  make localnet       - Start local validator"
	@echo "  make install        - Install npm dependencies"
	@echo "  make format         - Format Rust code"
	@echo "  make lint           - Lint Rust code"
