import asyncio
import sys
from pathlib import Path

# Add project root to sys.path
project_root = Path(__file__).parent.parent.resolve()
sys.path.insert(0, str(project_root))

from src.config.loader import config
from src.logger.logger import Logger
from start import CompositionRoot

async def main():
    logger = Logger("GroqVerify")
    logger.info("Initializing CompositionRoot...")
    comp_root = CompositionRoot()
    
    # Override configuration loaded to print Groq parameters
    logger.info(f"Loaded config: PROVIDER={config.PROVIDER}")
    logger.info(f"Groq API Key (starts with): {config.GROQ_API_KEY[:10]}...")
    logger.info(f"Groq Base URL: {config.GROQ_BASE_URL}")
    logger.info(f"Groq Model: {config.GROQ_MODEL}")
    
    deps = await comp_root.build_dependencies()
    model_manager = deps['model_manager']
    
    logger.info("Sending simple test query to Groq provider...")
    async with model_manager:
        response = await model_manager.send_prompt(
            prompt="Respond only with the exact word 'SUCCESS' if you hear this message.",
            system_message="You are a helpful trading assistant."
        )
        logger.info(f"Groq API Response: '{response}'")
        if "SUCCESS" in response:
            logger.info("Groq Provider Verification PASSED!")
        else:
            logger.error("Groq Provider Verification FAILED!")

if __name__ == "__main__":
    asyncio.run(main())
