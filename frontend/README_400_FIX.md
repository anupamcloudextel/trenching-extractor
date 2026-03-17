# Fix 400 on /_next/static/* (was working, now broken)

If **https://10.28.30.56** was working in the morning and now all CSS/JS return **400 Bad Request**, something on the server reverted the nginx fix (e.g. config overwrite, restart from old config, or another deploy).

---

## One command on the server (run as root)

**SSH to 10.28.30.56**, then:

```bash
cd /var/www/trenching-extractor-fresh/frontend
sudo bash diagnose-and-fix-400.sh
```

The script will:

1. **Check** whether the 400 comes from nginx or from Next.js.
2. **Show** the current nginx `server_name` for HTTPS (port 443).
3. **Patch** every HTTPS server block to add `10.28.30.56` to `server_name` (with a `.bak` backup).
4. **Reload** nginx and test again.

Then in the browser: open **https://10.28.30.56** and do a **hard refresh (Ctrl+Shift+R)**.

---

## Why it breaks again

- **Config overwrite:** A deploy or script might copy an nginx config that doesn’t include `10.28.30.56` in `server_name`. After deploy, run `diagnose-and-fix-400.sh` again, or change the deploy so it doesn’t overwrite this server block.
- **Wrong config loaded:** After a reboot, nginx may load a different file (e.g. from `sites-available`). Ensure the enabled site has `server_name 10.28.30.56` in the **443** block.
- **Multiple nginx configs:** If more than one file defines `listen 443`, the one that actually handles `Host: 10.28.30.56` must have `server_name 10.28.30.56`. The script patches all 443 blocks that don’t already have it.

---

## Manual fix (if you prefer to edit by hand)

1. Find the nginx file that has `listen 443 ssl;` (e.g. under `/etc/nginx/sites-enabled/` or `conf.d/`).
2. In that `server { ... }` block, set:
   ```nginx
   server_name 10.28.30.56 localhost;
   ```
3. Run: `sudo nginx -t && sudo systemctl reload nginx`
4. Hard refresh **https://10.28.30.56** in the browser.
