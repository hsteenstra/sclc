# Morse SCLC bulletin: setup

This folder is the whole website. Put it in its own GitHub repository and turn on GitHub Pages.

- The bulletin is `index.html`.
- The admin page is `admin.html`. There's also a small "Secretary login" link in the bulletin's footer.

Your updates are saved in a free Google Firebase project (`morse-sclc`).
Its settings are already in `firebase-config.js`.

## 1. Put the site on GitHub

1. On GitHub, create a new repository (for example `morse-sclc`).
2. Upload or push the files in this folder to the top level of that repository.
3. In the repository, open **Settings → Pages**. Under **Build and deployment**, pick **Deploy from a branch**, choose `main` and `/ (root)`, and save.
4. After a minute, GitHub shows the site's address, like `https://YOUR-USERNAME.github.io/morse-sclc/`.

## 2. Firebase web app settings

Already done: they're in `firebase-config.js`. These values are meant to be public.
The security rules in step 4 are what protect the bulletin.

## 3. Turn on Google sign-in

1. In the Firebase console (<https://console.firebase.google.com>), open **Build → Authentication** and click **Get started**.
2. Under **Sign-in method**, enable **Google** and save.
3. Under **Settings → Authorized domains**, click **Add domain** and add `YOUR-USERNAME.github.io`
   (just the domain from step 1, without `https://` or the `/morse-sclc/` part).

## 4. Turn on the database and paste in the rules

1. Open **Build → Firestore Database** and click **Create database**. Pick a US location and start in **production mode**.
2. Open the **Rules** tab, delete what's there, paste in everything from `firestore.rules`, and click **Publish**.

## 5. Make yourself an admin

1. In **Firestore Database → Data**, click **Start collection** and name it `admins`.
2. For the **Document ID**, type your Google email in all lowercase (for example `you@gmail.com`).
3. Add any field (for example `role` = `secretary`) and save.

To add another admin later, like the president, add another document to `admins` with their email as the ID.
To remove someone, delete their document.

## 6. Start using it

Open `admin.html` on your GitHub Pages address, sign in with Google, and fill in the next meeting.

## Every meeting

- **Before:** open Admin → **Next meeting → Edit** to set the agenda. Move good ideas from **Suggestions** with **Add to agenda**.
- **After:** click **Wrap up meeting**. It posts the minutes to Past meetings, moves the bulletin two weeks ahead, and clears the agenda.
- If nobody updates it, the date still moves forward on its own every two weeks.
