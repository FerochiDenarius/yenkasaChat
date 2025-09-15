#!/usr/bin/env bash
set -euo pipefail

# ========= Config =========
SUBSCRIPTION_ID="96be7dd5-6082-41e6-b30e-dab0bdad4803"
LOCATION="eastus"                 # changed to 'eastus' to bypass Azure policy
RG="rg-yenkasachat-eastus" # New resource group name to avoid conflict
PLAN="plan-yenkasachat"
APP="yenkasachat"                     # app name must be globally unique
RUNTIME="NODE:20-lts"                 # Node.js 20 on Linux

# ========= App Settings =========
MONGODB_URI="mongodb+srv://Denarius:%40Denarius01%40%24%24@yenkasachat.xsa2r9m.mongodb.net/yenkasaChat?retryWrites=true&w=majority"
REFRESH_TOKEN_SECRET="84Rw4xthXD9OXPF0uCZ66E1p+jAuwsg2RPncZ5KHImYD3v+82gCJKg8f57+HtfC/dTMsEmpbFirnHzdJD5sexQ=="

CLOUDINARY_CLOUD_NAME="dwjj3zsaq"
CLOUDINARY_API_KEY="548148892215273"
CLOUDINARY_API_SECRET="d3L_8BGtqM30JgkRHy6SabmKnc0"

ONESIGNAL_APP_ID="165df9e6-a0ea-4a37-a40a-110af7e28ad2"
ONESIGNAL_REST_API_KEY="os_v2_app_czo7tzva5jfdpjakcefppyuk2kfg5qu74gsed34rhjwskilsxsk43baomvtcp2wdtejrduitjubldd5atnpoakyb6hcwv6h5ncnmxmi"
ONESIGNAL_ANDROID_CHANNEL_ID=""

SMTP_HOST="smtp.zoho.com"
SMTP_PORT="587"
SMTP_SECURE="true"
EMAIL_USER="no.reply@yenkasa.xyz"
EMAIL_PASS="f0me0PqQ7y1C"
EMAIL_FROM="yenkasaChat<no.reply@yenkasa.xyz>"

FRONTEND_URL="[https://www.yenkasa.xyz](https://www.yenkasa.xyz)"

NODE_ENV="production"
# ============================================

echo "==> Setting subscription"
az account set --subscription "$SUBSCRIPTION_ID"

echo "==> Creating resource group: $RG ($LOCATION)"
az group create --name "$RG" --location "$LOCATION"

echo "==> Creating Linux App Service plan: $PLAN"
az appservice plan create \
  --name "$PLAN" \
  --resource-group "$RG" \
  --location "$LOCATION" \
  --sku B1 \
  --is-linux

echo "==> Creating Web App: $APP (runtime $RUNTIME)"
az webapp create \
  --name "$APP" \
  --resource-group "$RG" \
  --plan "$PLAN" \
  --runtime "$RUNTIME"

echo "==> Applying app settings"
az webapp config appsettings set \
  --resource-group "$RG" \
  --name "$APP" \
  --settings \
    NODE_ENV="$NODE_ENV" \
    MONGODB_URI="$MONGODB_URI" \
    REFRESH_TOKEN_SECRET="$REFRESH_TOKEN_SECRET" \
    CLOUDINARY_CLOUD_NAME="$CLOUDINARY_CLOUD_NAME" \
    CLOUDINARY_API_KEY="$CLOUDINARY_API_KEY" \
    CLOUDINARY_API_SECRET="$CLOUDINARY_API_SECRET" \
    ONESIGNAL_APP_ID="$ONESIGNAL_APP_ID" \
    ONESIGNAL_REST_API_KEY="$ONESIGNAL_REST_API_KEY" \
    ONESIGNAL_ANDROID_CHANNEL_ID="$ONESIGNAL_ANDROID_CHANNEL_ID" \
    SMTP_HOST="$SMTP_HOST" \
    SMTP_PORT="$SMTP_PORT" \
    SMTP_SECURE="$SMTP_SECURE" \
    EMAIL_USER="$EMAIL_USER" \
    EMAIL_PASS="$EMAIL_PASS" \
    EMAIL_FROM="$EMAIL_FROM" \
    FRONTEND_URL="$FRONTEND_URL"

echo "==> Enabling logging"
az webapp log config \
  --resource-group "$RG" \
  --name "$APP" \
  --application-logging true \
  --web-server-logging filesystem

# ------- Deploy (ZIP deploy) -------
echo "==> Creating deployment ZIP (excluding node_modules and VCS files)"
ZIP_FILE="deploy-$(date +%Y%m%d-%H%M%S).zip"
zip -r "$ZIP_FILE" . \
  -x "node_modules/*" ".git/*" ".gitignore" \
  -x "*.log" "tmp/*" "coverage/*"

echo "==> Deploying $ZIP_FILE"
az webapp deploy \
  --resource-group "$RG" \
  --name "$APP" \
  --src-path "$ZIP_FILE" \
  --type zip

echo "==> Restarting app"
az webapp restart --resource-group "$RG" --name "$APP"

echo "==> Done!"
echo "Browse: https://$APP.azurewebsites.net"
echo "Stream logs: az webapp log tail --resource-group $RG --name $APP"