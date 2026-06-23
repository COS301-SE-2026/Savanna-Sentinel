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

---
## Coding Style
Adapted from [PEP 8](https://peps.python.org/pep-0008/), althrough with modifications.
- Never exceed 80 characters on a line
  - Make a new line at a logicial location if threatening to exceed the limit.
- Either define all formal parameters on the same line, or each one on a new line with extra indentation from the body to ensure readability. e.g.

**Correct**
```
async def admin_delete_user(
        user_id: str,
        db: AsyncSession = Depends(get_db),
        current_admin: User = Depends(require_admin)
        ):
    repo = UserRepository(db)
    service = UserService(repo)
```
```
async def change_role(self, user_id: str, new_role: str):
    result = await self.repo.update_role(user_id, new_role)
    return result
```
- Seperate logical sections inside a method with a single blank line.
- Seperate method definitions with a single blank line.
  - This can be ignored if methods are related and minimal, such as getters or setters.
- Seperate logicial groups of methods with 2 blank lines.
- All boolean variables must contain a prefix that phrases the variable as a question. (e.g. is_correct/isCorrect)
- Imports must only be at the very top of the file.
- Include all method imports from a single package onto a single line or encapusulate in brackets
- All Globals must be defined under imports
- All strings must be encapsulated with double quotes("), using ` for template strings when necessary. Single quotes(') should be avoided to list a string.
  -  Triple double quotes(""") must be used for docstrings
- Arrays or similar data structures must include a trailing comma, for easy expansion later. e.g.
```
example_array = {
    "data_item_1": "test",
    "data_item_2": "test2", <-- trailing comma
}
```
- All arrays must use the above syntax, with 1 item being included per line
- All functions must define a return type, with typed Python or TypeScript interfaces.
  - The use of the any type should be avoided.
- Strict Equality should be used when possible (=== over ==)
- The use of the var word in the frontend is forbidden, use modern JS syntax such as let or const, preferring const unless the variable is designed to be changing.
- Binary operators must be surrounded by 2 empty spaces (1 + 2)
- Attempt to keep all variable declarations at the top of their respective block scope.
- Comments must be placed above the method/line they are explaining
  - Inline comments are forbidden.
- Arrow syntax (=>) is preferred for Javascript function definitions.
- A frontend file that contains Markdown language (\<tag>) must use the .tsx file extension. Else .ts must be used.
- All props must be destructured inside their component definition

**Correct**
```
const ExampleComp = ({itemId: string, isValid: boolean}) => {
    ...
}
```
**Incorrect**
```
const ExampleComp = (props: ExampleCompProps) => {
    const itemId: string = props.itemId
}
```
---





