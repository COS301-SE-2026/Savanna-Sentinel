# SIGILL CODING STANDARDS DOCUMENT
---

## File Structure
**Note**: Emdash was copypasted since it makes a better horizontal line in my opinion.
—└
```
Savanna-Sentinel/
|
|——backend/
|   |——init-db/          #Contains files to seed and initalise the database
|   |——tests/            #Contains the test files for the backend
|      |——integration/   #Contains the integration test files
|      └——unit/          #Contains the unit test files
|   |——app/
|      |——api/           #Contains the files used by various aspects of fastAPI
|         └——v1/         #Contains route information
|      |——core/          #Contains helper functions and some config files
|      |——models/        #Contains the database table structure
|      |——repositories/  #Contains files to interface with the database and retrieve data from the database
|      |——schemas/       #Contains DTO's and ViewModels to ensure data integrity
|      |——services/      #Contains main API functionality which router executes
|      └——workers/       #Contains celery/redis workers
|   |——Dockerfile
|   |——requirements.txt  #Contains Package information
|   └——.env              #User-generated file, contains keys and secrets.
|——frontend/
|   |——public/
|      └——icons/         #Contains static content used throughout the dashboard
|   |——src/              #Contains most frontend functionality
|      |——components/
|         |——ui/         #Contains general re-usable components that are used on multiple pages
|         └——{page_name}/#Contains reusable components specific to that page
|      |——hooks/         #Contains interceptors for every request when activated for the page.
|      |——lib/           #Contains helper functions
|      |——offline/       #Contains offline functionality for PWA
|      |——pages/         #Contains the raw page code for each route
|      |——services/      #Contains API call functions and helper functions
|      |——store/         #Contains persistent data for the session
|      |——styles/        #Contains scss files
|      |——tests/         #Contains frontend testing files
|         |——mocks/      #Contains mocks for unit tests
|         └——{file.test.tsx}
|      |——App.tsx        #The containing page of the SPA and also routing
|      └——main.tsx       #Wrapper for the App page
|   |——Dockerfile
|   └——.env              #Frontend environment configuration
|——docs/
|   |——archiecture/
|   |——design/
|   |——drafts/           #Contains .md drafts of docs, before formatting has occured and transformed to pdf
|   |——non-functional/
|   |——requirements/
|   └——research/         #Contains reasearch of AI methods to be used
└——docker-compose.yml
```

---
## Naming Conventions (Backend)
- **Files** - Snake Case (e.g. user_service.py)
- **Methods** - Snake Case
- **Variables** - Snake Case
- **Classes & Interfaces** - Pascal Case
- **Folders** - Attempt 1 word folder names, otherwise kebab case (e.g. init-db)
- **Constants** - Upper Snake Case (e.g. CONSTANT_VARIABLE)

## Naming Conventions (Frontend)
- **Files w/ Components** - Pascal Case (e.g. DataPreview.tsx)
- **Files w/ Helpers** - Camel Case
- **Methods** - Camel Case (Matching React Syntax)
- **Variables** - Camel Case
- **Components** - Pascal Case
- **Folders** - Attempt 1 word folder names, otherwise kebab case
- **Constant Globals** - UPPER SNAKE CASE (Otherwise follow Camel Case like a normal variable)

