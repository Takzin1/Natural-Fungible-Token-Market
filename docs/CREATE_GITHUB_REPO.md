# Publish the new GitHub repository

The connected GitHub integration cannot create new repositories, so the repository itself must first be created in the GitHub UI.

1. Open https://github.com/new
2. Owner: `Takzin1`.
3. Repository name: `Natural-Fungible-Token-Market`.
4. Description: `Research-only environmental asset market sandbox built alongside NaFT dMRV`.
5. Visibility: **Public**.
6. Do **not** add a README, .gitignore or LICENSE in the GitHub creation form, since the scaffold supplies the first two and intentionally excludes the third.
7. After creation, upload the scaffold files while preserving their directory paths, or push the unzipped directory using the commands below.

```sh
cd Natural-Fungible-Token-Market
git init -b main
git add .
git commit -m "Initial synthetic-only NFTM research market scaffold"
git remote add origin https://github.com/Takzin1/Natural-Fungible-Token-Market.git
git push -u origin main
```

You can also inform ChatGPT once the empty repository exists, so the GitHub connector can write the project files directly.
