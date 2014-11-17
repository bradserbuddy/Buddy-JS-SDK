# Buddy JavaScript SDK
These release notes are for the Buddy Platform JavaScript SDK.

Please refer to [buddyplatform.com/docs](https://buddyplatform.com/docs) for more details on the JavaScript SDK.

## Introduction

We realized most developers end up writing the same code over and over again: user management, photo management, geolocation, checkins, metadata, and other common features. Buddy enables developers to build cloud-connected apps without having to write, test, manage or scale server-side code and infrastructure.

Buddy's scenario-focused APIs let you spend more time building your application and less time worrying about backend infrastructure.

The JavaScript SDK handles the following functionality:

* Building and formatting requests
* Managing authentication
* Parsing responses
* Loading and saving credentials

## Getting Started

To get started with the Buddy Platform SDK, please reference the _Getting Started_ series of documents at [buddyplatform.com/docs](https://buddyplatform.com/docs). You will need an application ID and key before you can use the SDK. The _Getting Started_ documents will walk you through obtaining everything you need and show you where to find the SDK for your platform.

Application IDs and keys are obtained at the Buddy Developer Dashboard at [buddyplatform.com](https://buddyplatform.com/login).

Full documentation for Buddy's services are available at [buddyplatform.com/docs](https://buddyplatform.com/docs).

### Installing the SDK

1) Clone the repo to your desktop

    git clone git clone https://github.com/BuddyPlatform/Buddy-JS-SDK.git

2) Move the *buddy.js* file to a convenient location within your project

3) Create or open your HTML project

4) Add the following lines to your `<HEAD>...</HEAD>` tags or at the end of `<BODY>` before any other JavaScript

    <script src="http://ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js"></script>
    <script src="buddy.js"></script>

## Using the JavaScript SDK

Visit the [Buddy Dashboard](https://buddyplatform.com) to obtain your application ID and key.

### Initialize the SDK

`Buddy.init('[your app id]', '[your app key]');`

*You may see the word "Undefined" appear in your console here. This is not an error, it is simply Javascript's way of notifying you that the Buddy.init call does not return a value.*

### User Flow

The Buddy JavaScript SDK handles user creation and login.

#### Create A User
	
	// Only username and password are required
	Buddy.createUser({
	  username: 'test',
	  password: 'password',
	  firstName: 'Test',
	  lastName: 'User'
	  email: 'test@test.com',
	  dob: '4/23/1980'
	}, [callback]);

#### User Login
	
	// All functions from here on out accept callbacks
	// Callbacks are optional in the JavaScript SDK as indicated by the [ ]
	Buddy.loginUser('test', 'password', [callback]);

#### User Logout

	Buddy.logoutUser();

### REST Interface

Each SDK provides wrappers that make REST calls to Buddy.

#### POST

We now can call GET to [search for the checkin](https://buddyplatform.com/docs/Checkins#SearchCheckins) we just created!

	// POST to Checkins
	// Location is required
	Buddy.post('/checkins', {location: '34.052, -118.243', description: 'Somewhere in LA'}, [callback]);

#### GET

We now can call GET to [search for the checkin](https://buddyplatform.com/docs/Checkins#SearchCheckins) we just created!

	// GET a checkin by ID
	var checkinId;
	Buddy.get('/checkins/' + checkinId, [callback]);

#### PUT/PATCH/DELETE

Each remaining REST verb is available through the Buddy SDK using the same pattern as the POST and GET examples.

### Working With Files

Buddy offers support for binary files. The JavaScript SDK works with files through our REST interface similarly to other API calls.

**Note:** Responses for files deviate from the standard Buddy response templates. See the [Buddy Platform documentation](https://buddyplatform.com/docs) for more information.

#### Upload A File

Here we demonstrate uploading a picture. For all binary files (e.g. blobs and videos), the pattern is the same, but with a different path and different parameters. For full documentation see our [Media and Files](https://buddyplatform.com/docs/Media%20and%20Files) documentation page.

	// This example assumes both of the following HTML elements exist:
	// <input type="file" id="file" name="file" />
	// <input id="uploadButton" type="button" value="Upload" />

	$('#uploadButton').click(function() {
	  
	  var inputFile = $('#file')[0];
	  
	  var myImage = inputFile.files[0];
	  
	  Buddy.post('/pictures', {data: myImage});  
	  
	});

#### Download A File

Due to browser limitations the JavaScript SDK does not support direct file downloads.

## Contributing Back: Pull Requests

We'd love to have your help making the Buddy SDK as good as it can be!

To submit a change to the Buddy SDK please do the following:

1) Create your own fork of the Buddy SDK

2) Make the change to your fork

3) Before creating your pull request, please sync your repository to the current state of the parent repository: `git pull origin master`

4) Commit your changes, then [submit a pull request](https://help.github.com/articles/using-pull-requests) for just that commit

## License

#### Copyright (C) 2014 Buddy Platform, Inc.

Licensed under the Apache License, Version 2.0 (the "License"); you may not
use this file except in compliance with the License. You may obtain a copy of
the License at

  [http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0)

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
License for the specific language governing permissions and limitations under
the License.


