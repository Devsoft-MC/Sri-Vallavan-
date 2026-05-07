#!/bin/bash
# Backup Sri-Vallavan app to backups folder with timestamp

SOURCE="/Users/manojchendran/Downloads/Sri-Vallavan"
DEST="/Users/manojchendran/projects/backups/Sri-Vallavan-$(date +%Y%m%d_%H%M%S)"

cp -r "$SOURCE" "$DEST"
echo "Backup completed: $DEST"