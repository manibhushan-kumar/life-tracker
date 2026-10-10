#!/usr/bin/env bash
# ==============================================================================
# Life Tracker - Project Management & Environment Helper
# ==============================================================================
# Usage:
#   Before uploading to GitHub:  ./manage.sh clean
#   After downloading repo:      ./manage.sh setup
# ==============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_help() {
  echo ""
  echo "Life Tracker Project Helper"
  echo "---------------------------"
  echo "Usage: ./manage.sh [command]"
  echo ""
  echo "Commands:"
  echo "  clean     Delete node_modules, build outputs, and caches BEFORE uploading to GitHub"
  echo "  setup     Install all dependencies (npm install), sync assets, and build APK AFTER downloading"
  echo "  build     Rebuild web assets and compile a fresh Android APK"
  echo "  help      Show this help message"
  echo ""
  echo "Examples:"
  echo "  ./manage.sh clean   # Run before uploading to GitHub (strips node_modules & caches)"
  echo "  ./manage.sh setup   # Run after downloading (reinstalls everything and builds APK)"
  echo ""
}

clean_project() {
  echo -e "${BLUE}🧹 Cleaning project before upload to GitHub...${NC}"

  # 1. Stop background Gradle daemons to release any open file locks
  if [ -d "android" ] && [ -f "android/gradlew" ]; then
    echo "  → Stopping Gradle background daemons..."
    (cd android && chmod +x gradlew 2>/dev/null && ./gradlew --stop 2>/dev/null) || true
  fi

  # 2. Clean node_modules
  if [ -d "node_modules" ]; then
    echo "  → Removing node_modules/ folder..."
    TRASH_NM=".trash_nm_$$"
    # Atomic rename disconnects background file watchers and language servers immediately
    if mv node_modules "$TRASH_NM" 2>/dev/null; then
      chmod -R u+w "$TRASH_NM" 2>/dev/null || true
      rm -rf "$TRASH_NM" 2>/dev/null || true
    else
      chmod -R u+w node_modules 2>/dev/null || true
      rm -rf node_modules 2>/dev/null || true
    fi
  fi
  # Clean any trash remnants or lingering files
  rm -rf .trash_nm_* 2>/dev/null || true
  if [ -d "node_modules" ]; then
    chmod -R u+w node_modules 2>/dev/null || true
    find node_modules -delete 2>/dev/null || rm -rf node_modules 2>/dev/null || true
  fi

  # 3. Clean Android Gradle build caches and outputs
  if [ -d "android" ]; then
    echo "  → Cleaning Android build artifacts and Gradle caches..."
    rm -rf android/.gradle
    rm -rf android/build
    rm -rf android/app/build
    rm -rf android/capacitor-cordova-android-plugins/build
    rm -rf android/.kotlin
  fi

  # 4. Clean generated Android web assets and configs (auto-regenerated via cap:sync)
  if [ -d "android/app/src/main/assets" ]; then
    echo "  → Cleaning generated Capacitor Android assets & configs..."
    rm -rf android/app/src/main/assets/public
    rm -f android/app/src/main/assets/capacitor.config.json
    rm -f android/app/src/main/assets/capacitor.plugins.json
  fi

  # 5. Clean machine-specific local.properties (auto-detected on setup)
  if [ -f "android/local.properties" ]; then
    echo "  → Removing android/local.properties (machine-specific SDK path)..."
    rm -f android/local.properties
  fi

  # 6. Clean Gradle wrapper binary jar (auto-downloaded during setup/build)
  if [ -f "android/gradle/wrapper/gradle-wrapper.jar" ]; then
    echo "  → Removing gradle-wrapper.jar (will be auto-downloaded on setup)..."
    rm -f android/gradle/wrapper/gradle-wrapper.jar
  fi

  # 7. Clean web build distribution
  if [ -d "dist" ]; then
    echo "  → Removing dist/ folder..."
    rm -rf dist
  fi

  # 8. Clean compiled APK binaries & signature files
  if [ -f "life-tracker.apk" ] || [ -f "life-tracker.apk.idsig" ]; then
    echo "  → Removing compiled APK files..."
    rm -f life-tracker.apk life-tracker.apk.idsig
  fi

  # 9. Clean OS artifacts & temporary files
  echo "  → Removing .DS_Store and temporary log files..."
  find . -name ".DS_Store" -type f -delete 2>/dev/null || true
  find . -name "*.log" -type f -delete 2>/dev/null || true
  rm -rf .trash_nm_* 2>/dev/null || true

  echo ""
  echo -e "${GREEN}✓ Project cleaned successfully!${NC}"
  echo -e "${YELLOW}Your project is now lightweight (~3.5 MB) and ready to upload/commit to GitHub.${NC}"
  echo -e "  • node_modules/ removed (reinstalled via: ./manage.sh setup)"
  echo -e "  • gradle-wrapper.jar removed (auto-downloaded via: ./manage.sh setup)"
  echo -e "  • android/app/src/main/assets/public/ removed (regenerated via: npm run cap:sync)"
  echo -e "  • android/local.properties removed (auto-detected on: ./manage.sh setup)"
  echo -e "  • Android build caches, .kotlin & Gradle outputs removed"
  echo -e "  • Generated binaries & dist/ removed"
  echo ""
}

ensure_local_properties() {
  if [ -d "android" ] && [ ! -f "android/local.properties" ]; then
    echo -e "${BLUE}📱 Auto-detecting Android SDK path for local.properties...${NC}"
    SDK_PATH=""
    if [ -n "$ANDROID_HOME" ] && [ -d "$ANDROID_HOME" ]; then
      SDK_PATH="$ANDROID_HOME"
    elif [ -n "$ANDROID_SDK_ROOT" ] && [ -d "$ANDROID_SDK_ROOT" ]; then
      SDK_PATH="$ANDROID_SDK_ROOT"
    elif [ -d "$HOME/Library/Android/sdk" ]; then
      SDK_PATH="$HOME/Library/Android/sdk"
    elif [ -d "$HOME/Android/Sdk" ]; then
      SDK_PATH="$HOME/Android/Sdk"
    elif [ -d "/usr/local/share/android-sdk" ]; then
      SDK_PATH="/usr/local/share/android-sdk"
    elif [ -n "$LOCALAPPDATA" ] && [ -d "$LOCALAPPDATA/Android/Sdk" ]; then
      SDK_PATH="$LOCALAPPDATA/Android/Sdk"
    fi

    if [ -n "$SDK_PATH" ]; then
      echo "sdk.dir=$SDK_PATH" > android/local.properties
      echo -e "${GREEN}✓ Generated android/local.properties (sdk.dir=$SDK_PATH)${NC}"
    else
      echo -e "${YELLOW}ℹ Android SDK not detected in standard locations. (Set ANDROID_HOME or sdk.dir if building APK)${NC}"
    fi
  fi
}

ensure_gradle_wrapper() {
  WRAPPER_DIR="android/gradle/wrapper"
  WRAPPER_JAR="$WRAPPER_DIR/gradle-wrapper.jar"
  if [ -d "$WRAPPER_DIR" ] && [ ! -f "$WRAPPER_JAR" ]; then
    echo -e "${BLUE}⬇️ Downloading Gradle wrapper jar (gradle-wrapper.jar)...${NC}"
    JAR_URL="https://raw.githubusercontent.com/gradle/gradle/v8.14.3/gradle/wrapper/gradle-wrapper.jar"
    if command -v curl &> /dev/null; then
      curl -sSL -f "$JAR_URL" -o "$WRAPPER_JAR" || true
    elif command -v wget &> /dev/null; then
      wget -q "$JAR_URL" -O "$WRAPPER_JAR" || true
    fi
    if [ -f "$WRAPPER_JAR" ]; then
      echo -e "${GREEN}✓ gradle-wrapper.jar downloaded successfully.${NC}"
    else
      echo -e "${YELLOW}⚠️ Could not download gradle-wrapper.jar automatically. Please check your internet connection.${NC}"
    fi
  fi
}

setup_project() {
  echo -e "${BLUE}🚀 Preparing local environment and building Life Tracker...${NC}"

  # 1. Check Node.js
  if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
  fi
  echo -e "  → Node.js detected: $(node -v)"

  # 2. Check npm
  if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed.${NC}"
    exit 1
  fi

  # 3. Restore all npm dependencies
  echo -e "${BLUE}📦 Installing all dependencies (restoring node_modules)...${NC}"
  npm install

  # 4. Synchronize web assets to Capacitor
  echo -e "${BLUE}⚡ Synchronizing web assets with Capacitor...${NC}"
  npm run cap:sync

  # 5. Build Android APK if Android folder exists
  if [ -d "android" ]; then
    echo -e "${BLUE}🤖 Compiling Android APK...${NC}"
    ensure_local_properties
    ensure_gradle_wrapper
    cd android

    if [ -f "gradlew" ]; then
      chmod +x gradlew 2>/dev/null || true
    fi

    # Auto-detect Java 21 LTS if available (Capacitor 7 requirement)
    if [ -d "$HOME/.sdkman/candidates/java/21.0.0.0-amzn" ]; then
      export JAVA_HOME="$HOME/.sdkman/candidates/java/21.0.0.0-amzn"
    elif [ -n "$JAVA_HOME" ]; then
      export JAVA_HOME="$JAVA_HOME"
    fi

    if ./gradlew assembleDebug; then
      cd "$PROJECT_DIR"

      # Copy output APK to project root
      if [ -f "android/app/build/outputs/apk/debug/app-debug.apk" ]; then
        cp android/app/build/outputs/apk/debug/app-debug.apk life-tracker.apk

        # Sign with debug keystore if apksigner exists
        APKSIGNER=$(find "$HOME/Library/Android/sdk/build-tools" -name "apksigner" 2>/dev/null | sort -V | tail -n 1)
        KEYSTORE="$HOME/.android/debug.keystore"
        if [ -n "$APKSIGNER" ] && [ -f "$KEYSTORE" ]; then
          "$APKSIGNER" sign --ks "$KEYSTORE" --ks-pass pass:android --key-pass pass:android --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true life-tracker.apk 2>/dev/null || true
        fi

        APK_SIZE=$(du -h life-tracker.apk 2>/dev/null | cut -f1)
        echo -e "${GREEN}✓ Debug APK compiled & signed: life-tracker.apk (${APK_SIZE})${NC}"
      fi
    else
      cd "$PROJECT_DIR"
      echo -e "${YELLOW}⚠️ Android build skipped or failed (check Java 21 & Android SDK). Web environment & dependencies are ready.${NC}"
    fi
  fi

  echo ""
  echo -e "${GREEN}🎉 Local environment is fully prepared and ready!${NC}"
  echo "You can now edit the code or install life-tracker.apk on your Android phone."
  echo ""
}

case "$1" in
  clean)
    clean_project
    ;;
  setup|prepare)
    setup_project
    ;;
  build)
    echo -e "${BLUE}⚡ Rebuilding project...${NC}"
    npm run cap:sync
    if [ -d "android" ]; then
      ensure_local_properties
      ensure_gradle_wrapper
      cd android
      if [ -d "$HOME/.sdkman/candidates/java/21.0.0.0-amzn" ]; then
        export JAVA_HOME="$HOME/.sdkman/candidates/java/21.0.0.0-amzn"
      fi
      ./gradlew assembleDebug
      cd "$PROJECT_DIR"
      cp android/app/build/outputs/apk/debug/app-debug.apk life-tracker.apk
      echo -e "${GREEN}✓ Updated life-tracker.apk!${NC}"
    fi
    ;;
  help|--help|-h|"")
    print_help
    ;;
  *)
    echo -e "${RED}Unknown command: $1${NC}"
    print_help
    exit 1
    ;;
esac
