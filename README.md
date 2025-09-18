##### Description Section

This app is the demo for Synamedia Iris and includes scenarios of SSAI-VOD, SSAI-Linear and CSAI

# SSAI-VOD
Side by side profile players based on dash.js, will handle pre/mid/post roll ad insertion cases.
-> Controls
--- From menu, access to multiple demo scenarios
--- Loads scenario names, profiles and flags
--- Loads Tracking Event Panel: Impression, AdStart, 25%, 50%, 75%, AdCompletion
-> Usage
--- Always click "Load/Reload" first, then "Play".
--- During a session, can pause/play normally. But when clicks "Stop" it is mandatory clicking "Load/Reload" again.
--- Left/Right clickthrough will open a new tab with the landpage configured in the adserver and fire the click event.
--- Volume for Left/Right, playback always starts muted for both players.
--- Skip button will go to ~4 seconds before the post roll.
--- rnd.did is default selected, when selected will randomize the deviceID everytime "Load/Reload" is clicked.

# SSAI-Linear
Side by side profile players based on dash.js, will handle mid roll ad replacement cases.
-> Controls
--- From menu, access to multiple demo scenarios
--- Loads scenario names, profiles and flags
--- Loads Tracking Event Panel: Impression, AdStart, 25%, 50%, 75%, AdCompletion
-> Usage
--- It auto plays the linear content.
--- In case the players get too much out of sync, click "Stop" and "Load/Reload".
--- Button "Play" does not have a function.
--- Left/Right clickthrough will open a new tab with the landpage configured in the adserver and fire the click event.
--- Volume for Left/Right, playback always starts muted for both players.
--- On page load it will connect to Iris_WOF.py websocket ... therefore, this page should be loaded after the WOF is already running. If by any chance you need to close and load again the WOF, please, go to Home and reload the desired SSAI-Linear use case.
--- From Iris_WOF.py, the websocket signs to linear.js when the wheel of fortune spin reaches the special case, then linear.js will bring the image captured as an overlay of the Left player (only the left player).

# CSAI-New Inventories
## AdOnPause Use Case
It will bring only the left player for this use case
-> Controls
--- From menu, access to multiple demo scenarios
--- Loads scenario names, profiles and flags
--- Loads Tracking Event Panel: Impression, AdStart, 25%, 50%, 75%, AdCompletion
--- Options: Display | Video, refers to the adForm used for the pause action
-> Usage
--- Always click "Load/Reload" first, then "Play".
--- After the pre-roll, can pause/play normally. when pausing, the system will: (if Display is selected) rotate among three full screen display ads with a top overlay message. Every display ad shown is one atomic ad decision and therefore one new impression; (if Video is selected) Check whether Start or Resume are activated, if Start is selected then it will play the video ad decision as the regular content is paused then keep the regular content in pause state after the ad playback, if Resume is selected then it will pause the regular content then play the video ad decision as a "pre-roll" before unpause the regular content.
## AdVideo + Overlay
It will bring an independent ad decision overlay to be used together with the pre-roll video ad.
-> Controls
--- From menu, access to multiple demo scenarios
--- Loads scenario names, profiles and flags
--- Loads Tracking Event Panel: Impression, AdStart, 25%, 50%, 75%, AdCompletion
-> Usage
--- Always click "Load/Reload" first, then "Play".
--- There is a zoom button which will bring the video much bigger for the demo cases where the overlay brings a real QRCode and we want the client to scan it. The zoom, when activated will keep the video in zoom state for 5 seconds then resume the regular size automatically. 
## Linear Channel Change and Point of Interest
Side by side profile players based on dash.js, will handle display ad insertion use cases.
-> Controls
--- From menu, access to multiple demo scenarios
--- Loads scenario names, profiles and flags
--- Loads Tracking Event Panel: Impression, AdStart, 25%, 50%, 75%, AdCompletion
-> Usage
--- It auto plays the linear content.
--- Channel UP/Channel Down will simulate a channel change, there are two channel playback URLs.
--- In the channel change it will reduce the player size and add a display ad for different profiles in left/right players, this will stand for 10 seconds and return to the regular player size.
--- For the point of interest - DAI - use case, it is needed to bring the Iris_WOF again, on its last tab there is an option to connect to a MQTT service in the specific topic 'linearcc/triggerDAI' this page also connects to the same topic and keeps listening for the messages. From Iris_WOF it is possible to send two payloads with simple '1' and '2' values. The value '1' will trigger a regular display ad side-by-side in the same channel (do not depend on user action to change channel) and the value '2' will trigger a specific 'injury' themed ad simulating a football game stopped for an injury time and actioning a DAI.
--- Only display is operational, video ad form is still under development.
## AI
Will open in a new browser tab the NAB/IBC Iris demo of agentic AI.

----- This demo use cases are commanded by the data.json file which feeds automatically the sub-menu use cases based on:

| Field                   | Required | Description                                                         |
| ----------------------- | -------- | ------------------------------------------------------------------- |
| demo_scene              | ✅       | String/number used to derive the route (`/playback3`, `/specials5`) |
| type                    | ✅       | One of `VOD`, `LINEAR`, `LINEARCC`, `SPECIALS`                      |
| active                  | Optional | Set to `false` to remove the scene from menus and routing           |
| menu_title              | ✅       | Label shown in the dropdown menu                                    |
| left/right_title        | ✅       | Title shown above each player pane                                  |
| left/right_segment      | Optional | Additional descriptive subtitle for each pane                       |
| left/right_flag         | Optional | Image URL rendered next to the title                                |
| left/right_playback_url | ✅       | DASH manifest or stream URL loaded by dash.js                       |
| volume                  | Optional | Initial volume label (e.g. `"20%"`)                                 |
| postroll_offset         | Optional | Seconds to jump when “Skip to Post-roll” is triggered               |
| inAdPause / inAdPauseVideo / inAdOverlay / inSequence | Specials only | Controls pause/overlay behavior for `Specials` scenes |

### Scenario Types

| `type` value | Route pattern     | Component      | Notable fields / behavior                                                    |
| ------------ | ----------------- | -------------- | ----------------------------------------------------------------------------- |
| `VOD`        | `/playback{n}`    | `Vod`          | Supports `postroll_offset`; click-through metrics tracked per ad break        |
| `LINEAR`     | `/playback{n}`    | `Linear`       | Uses live linear streams; honors `left/right_playback_url` for live manifests |
| `LINEARCC`   | `/linearcc{n}`    | `LinearCC`     | Enables MQTT client for closed-caption/companion interactions                 |
| `SPECIALS`   | `/specials{n}`    | `Specials`     | Reads pause/overlay flags (`inAdPause`, `inAdPauseVideo`, `inAdOverlay`)      |


##### NPM session

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start-iris`

Runs the app in the development mode.\
Opens the app using http://irisdemo.com:3000 hostname, in theory with AdServer and SSAI CORS resolved (by the hostname)

### `npm start-both`

Runs the app with the Chrome browser security check disable.
It should be used only as the last resort in case of serious CORS issues.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

