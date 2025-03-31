#!/bin/bash

# Set up environment (if needed)
# source ~/.bash_profile  # Uncomment if you need to load your bash profile

# Navigate to the directory containing your Salesforce project
cd ~/pace-sf

# Run the Salesforce scanner command
sf scanner run -e pmd -f html --normalize-severity --pmdconfig ~/pace-sf/config/pmd-rules.xml -o ~/changelog-app/public/static.html

# Optional: Add a timestamp to a log file
echo "Salesforce scan completed at $(date)" >> ~/sf_scanner_cron.log